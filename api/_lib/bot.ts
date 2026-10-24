// Trata uma mensagem recebida: evita repetição, liga o número à conta (pelo código gerado
// no app) e, para números já ligados, passa a mensagem ao motor da conversa.
import { lerCodigo } from "../../src/lib/codigoWhatsapp.js"
import type { Moeda } from "../../src/types/database.js"
import { AJUDA, ESTADO_INICIAL, responder, type Estado, type Etapa, type Rascunho } from "./conversa.js"
import { dadosDoUsuario, type Banco } from "./dados.js"
import { dataNoFuso, fusoDoTelefone, type MensagemRecebida } from "./whatsapp.js"

/** Rascunho parado há mais que isso é descartado. */
const CONVERSA_EXPIRA_MS = 30 * 60 * 1000
const MAX_TENTATIVAS_CODIGO = 5
const BLOQUEIO_MS = 60 * 60 * 1000

export interface Ambiente {
  db: Banco
  enviar: (para: string, texto: string) => Promise<void>
  agora: Date
  fusoPadrao: string
}

export async function tratarMensagem(m: MensagemRecebida, amb: Ambiente): Promise<void> {
  // O WhatsApp reenvia o webhook quando não recebe 200 a tempo: cada id é tratado uma vez só.
  const { error: repetida } = await amb.db.from("whatsapp_mensagens").insert({ id: m.id })
  if (repetida) {
    if (repetida.code === "23505") return
    throw repetida
  }

  if (m.texto === null) {
    await amb.enviar(m.de, "Por enquanto eu só entendo mensagens de texto. Mande _ajuda_ para ver o que eu faço.")
    return
  }

  const { data: vinculo, error } = await amb.db
    .from("whatsapp_vinculos")
    .select("user_id")
    .eq("telefone", m.de)
    .maybeSingle()
  if (error) throw error

  const resposta = vinculo
    ? await conversar(m.de, m.texto, vinculo.user_id, amb)
    : await tentarVincular(m.de, m.texto, amb)
  await amb.enviar(m.de, resposta)
}

async function conversar(telefone: string, texto: string, userId: string, amb: Ambiente): Promise<string> {
  const { db, agora } = amb
  const [{ data: conversa, error }, { data: usuario, error: usuarioError }] = await Promise.all([
    db.from("whatsapp_conversas").select("etapa, rascunho, atualizado_em").eq("telefone", telefone).maybeSingle(),
    db.auth.admin.getUserById(userId),
  ])
  if (error) throw error
  if (usuarioError) throw usuarioError

  const expirada = !conversa || agora.getTime() - new Date(conversa.atualizado_em).getTime() > CONVERSA_EXPIRA_MS
  const estado: Estado = expirada
    ? ESTADO_INICIAL
    : { etapa: conversa.etapa as Etapa, rascunho: conversa.rascunho as Rascunho | null }

  const ctx = {
    hoje: dataNoFuso(agora, fusoDoTelefone(telefone, amb.fusoPadrao)),
    moeda: (usuario.user?.user_metadata?.moeda_padrao as Moeda | undefined) ?? "EUR",
  }

  let novoEstado = ESTADO_INICIAL
  let resposta: string
  try {
    const resultado = await responder(estado, texto, ctx, dadosDoUsuario(db, userId))
    novoEstado = resultado.estado
    resposta = resultado.resposta
  } catch (erro) {
    console.error("Erro ao responder", erro)
    resposta = "Algo deu errado do meu lado e nada foi lançado. Tente de novo em instantes."
  }

  const { error: salvarError } = await db.from("whatsapp_conversas").upsert({
    telefone,
    etapa: novoEstado.etapa,
    rascunho: novoEstado.rascunho as Record<string, unknown> | null,
    atualizado_em: agora.toISOString(),
  })
  if (salvarError) throw salvarError
  return resposta
}

const BOAS_VINDAS = [
  "Olá! Para usar este bot, ligue este número à sua conta do *Tudo em dia*:",
  "",
  "1. Abra o app → *Configurações* → *WhatsApp*",
  "2. Toque em *Gerar código*",
  "3. Mande o código aqui",
].join("\n")

/** Número ainda sem conta: se a mensagem for um código válido, faz a ligação. */
async function tentarVincular(telefone: string, texto: string, amb: Ambiente): Promise<string> {
  const { db, agora } = amb
  const codigo = lerCodigo(texto)
  if (!codigo) return BOAS_VINDAS

  const { data: conversa, error } = await db
    .from("whatsapp_conversas")
    .select("tentativas_codigo, bloqueado_ate")
    .eq("telefone", telefone)
    .maybeSingle()
  if (error) throw error
  if (conversa?.bloqueado_ate && new Date(conversa.bloqueado_ate) > agora) {
    return "Muitas tentativas com código errado. Espere uma hora e gere um código novo no app."
  }

  const { data: encontrado, error: codigoError } = await db
    .from("whatsapp_codigos")
    .select("user_id, expira_em")
    .eq("codigo", codigo)
    .maybeSingle()
  if (codigoError) throw codigoError

  if (!encontrado || new Date(encontrado.expira_em) <= agora) {
    // Limita chutes: sem isso daria para tentar códigos até acertar o de outra pessoa.
    const tentativas = (conversa?.tentativas_codigo ?? 0) + 1
    const bloquear = tentativas >= MAX_TENTATIVAS_CODIGO
    const { error: contarError } = await db.from("whatsapp_conversas").upsert({
      telefone,
      tentativas_codigo: bloquear ? 0 : tentativas,
      bloqueado_ate: bloquear ? new Date(agora.getTime() + BLOQUEIO_MS).toISOString() : null,
      atualizado_em: agora.toISOString(),
    })
    if (contarError) throw contarError
    return "Código inválido ou vencido. Gere outro em *Configurações* → *WhatsApp* no app."
  }

  // Uma conta tem um número só: ligar este solta o anterior.
  const { error: soltarError } = await db.from("whatsapp_vinculos").delete().eq("user_id", encontrado.user_id)
  if (soltarError) throw soltarError
  const { error: ligarError } = await db
    .from("whatsapp_vinculos")
    .insert({ telefone, user_id: encontrado.user_id })
  if (ligarError) throw ligarError
  await db.from("whatsapp_codigos").delete().eq("user_id", encontrado.user_id)
  await db.from("whatsapp_conversas").upsert({
    telefone,
    etapa: "livre",
    rascunho: null,
    tentativas_codigo: 0,
    bloqueado_ate: null,
    atualizado_em: agora.toISOString(),
  })

  return `✅ WhatsApp conectado à sua conta!\n\n${AJUDA}`
}
