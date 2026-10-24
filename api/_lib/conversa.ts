// Motor da conversa do bot: recebe o estado salvo, a mensagem e o acesso aos dados do
// usuário, e devolve o novo estado e a resposta. Não sabe nada de WhatsApp nem de Supabase.
import {
  formatarCompetencia,
  montarCompetencia,
  proximaCompetencia,
  type Competencia,
} from "../../src/lib/competencia.js"
import { formatarMoeda } from "../../src/lib/format.js"
import type { Moeda, Status } from "../../src/types/database.js"

export type Etapa =
  | "livre"
  | "descricao"
  | "tipo"
  | "cartao"
  | "parcelas"
  | "mes_fatura"
  | "mes_fatura_outro"
  | "categoria"
  | "dia"
  | "pago"
  | "tipo_receita"

type TipoLancamento = "cartao" | "mensal" | "unica" | "receita"

interface Opcao {
  id: string | null
  nome: string
}

export interface Rascunho {
  valor: number
  descricao?: string
  tipo?: TipoLancamento
  cartaoId?: string
  cartaoNome?: string
  parcelas?: number
  mesFatura?: Competencia
  categoriaId?: string | null
  categoriaNome?: string
  dia?: number
  /** Opções numeradas mostradas na última pergunta, para "2" valer o que a pessoa viu. */
  opcoes?: Opcao[]
  /** Última pergunta feita, repetida quando a resposta não é entendida. */
  pergunta?: string
}

export interface Estado {
  etapa: Etapa
  rascunho: Rascunho | null
}

export const ESTADO_INICIAL: Estado = { etapa: "livre", rascunho: null }

export interface CartaoBot {
  id: string
  nome: string
  dia_fechamento: number
  dia_vencimento: number
}

export interface CategoriaBot {
  id: string
  nome: string
}

export interface ResumoMes {
  receitas: number
  compromissos: { nome: string; valor: number; vencimento: string; status: Status }[]
  parcelas: {
    valor: number
    status: Status
    descricao: string
    numero: number
    total: number
    cartaoId: string
    cartaoNome: string
  }[]
}

/** Acesso aos dados de UM usuário (o dono do número que mandou a mensagem). */
export interface DadosDoUsuario {
  cartoes(): Promise<CartaoBot[]>
  categorias(): Promise<CategoriaBot[]>
  resumoDoMes(competencia: Competencia): Promise<ResumoMes>
  /** Soma das parcelas pendentes de todos os meses, por id do cartão. */
  pendenteTotalPorCartao(): Promise<Map<string, number>>
  lancarCompraCartao(i: {
    cartaoId: string
    descricao: string
    valorTotal: number
    parcelas: number
    mesInicial: Competencia
  }): Promise<void>
  lancarConta(i: {
    nome: string
    valor: number
    vencimento: string
    categoriaId: string | null
    recorrencia: "recorrente" | "eventual"
    pago: boolean
  }): Promise<void>
  lancarReceita(i: { nome: string; valor: number; data: string; recorrente: boolean }): Promise<void>
}

export interface Contexto {
  /** Data de hoje no fuso do usuário, 'YYYY-MM-DD'. */
  hoje: string
  moeda: Moeda
}

export interface Resultado {
  estado: Estado
  resposta: string
}

// ---------------------------------------------------------------------------
// Leitura do que a pessoa escreveu
// ---------------------------------------------------------------------------

export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

/**
 * Acha o primeiro valor em dinheiro do texto e devolve o resto como descrição.
 * Aceita "45", "45,90", "45.90", "1.234,56", "R$ 1234", "€12".
 */
export function lerValor(texto: string): { valor: number; resto: string } | null {
  const m = texto.match(/(?:r\$|€)?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d/])/i)
  if (!m || m.index === undefined) return null
  const bruto = m[1]
  const numero = /\.\d{3}/.test(bruto) && !/\.\d{1,2}$/.test(bruto)
    ? bruto.replace(/\./g, "").replace(",", ".")
    : bruto.replace(",", ".")
  const valor = Math.round(Number(numero) * 100) / 100
  if (!Number.isFinite(valor) || valor <= 0) return null
  const resto = (texto.slice(0, m.index) + " " + texto.slice(m.index + m[0].length))
    .replace(/\s+/g, " ")
    .replace(/^\s*(de|em|no|na)\s+/i, "")
    .trim()
  return { valor, resto }
}

/** Escolha numa lista: pelo número mostrado ou por um pedaço único do nome. */
function lerOpcao(texto: string, opcoes: Opcao[]): Opcao | null {
  const t = normalizar(texto)
  if (/^\d+$/.test(t)) return opcoes[Number(t) - 1] ?? null
  if (t.length < 3) return null
  const achadas = opcoes.filter((o) => normalizar(o.nome).includes(t))
  return achadas.length === 1 ? achadas[0] : null
}

function lerSimNao(texto: string): boolean | null {
  const t = normalizar(texto)
  if (["1", "s", "sim", "ss", "isso", "certo", "ok", "pode", "ja", "ja paguei"].includes(t)) return true
  if (["2", "n", "nao", "ainda nao", "outro", "outro mes"].includes(t)) return false
  return null
}

const MESES_NOMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

/** "12", "12/2026", "12/26", "dezembro", "dez 2026" → 'YYYY-MM'. Sem ano, pega o próximo daquele mês. */
export function lerMes(texto: string, hoje: string): Competencia | null {
  const t = normalizar(texto)
  const [anoHoje, mesHoje] = hoje.split("-").map(Number)
  let mes: number | null = null
  let ano: number | null = null

  const numerico = t.match(/^(\d{1,2})(?:\s*[/-]\s*(\d{2}|\d{4}))?$/)
  const porNome = t.match(/^([a-z]{3})[a-z]*(?:\s*(?:de\s*)?[/-]?\s*(\d{2}|\d{4}))?$/)
  if (numerico) {
    mes = Number(numerico[1])
    if (numerico[2]) ano = Number(numerico[2])
  } else if (porNome && MESES_NOMES.includes(porNome[1])) {
    mes = MESES_NOMES.indexOf(porNome[1]) + 1
    if (porNome[2]) ano = Number(porNome[2])
  }
  if (!mes || mes < 1 || mes > 12) return null
  if (ano !== null && ano < 100) ano += 2000
  if (ano === null) ano = mes >= mesHoje ? anoHoje : anoHoje + 1
  return montarCompetencia(ano, mes)
}

function lerDia(texto: string, hoje: string): number | null {
  const t = normalizar(texto)
  if (t === "hoje") return Number(hoje.slice(8, 10))
  const m = t.match(/^(?:dia\s*)?(\d{1,2})$/)
  if (!m) return null
  const dia = Number(m[1])
  return dia >= 1 && dia <= 31 ? dia : null
}

function lerParcelas(texto: string): number | null {
  const t = normalizar(texto)
  if (["a vista", "avista", "vista"].includes(t)) return 1
  const m = t.match(/^(\d{1,2})\s*(?:x|vezes)?$/)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 60 ? n : null
}

// ---------------------------------------------------------------------------
// Regras de data
// ---------------------------------------------------------------------------

/** 'YYYY-MM-DD' com o dia limitado ao último dia daquele mês. */
export function dataNoMes(competencia: Competencia, dia: number): string {
  const [ano, mes] = competencia.split("-").map(Number)
  const ultimo = new Date(ano, mes, 0).getDate()
  return `${competencia}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`
}

/**
 * Mês da fatura em que cai uma compra feita hoje: a fatura fecha no mês atual se a compra
 * foi até o dia de fechamento, senão no próximo; e vence no mesmo mês do fechamento quando o
 * dia de vencimento vem depois do de fechamento, senão no mês seguinte. A fatura é contada
 * no mês em que vence.
 */
export function mesDaFatura(cartao: Pick<CartaoBot, "dia_fechamento" | "dia_vencimento">, hoje: string): Competencia {
  const dia = Number(hoje.slice(8, 10))
  const atual = hoje.slice(0, 7)
  const fechamento = dia <= cartao.dia_fechamento ? atual : proximaCompetencia(atual)
  return cartao.dia_vencimento > cartao.dia_fechamento ? fechamento : proximaCompetencia(fechamento)
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

export const AJUDA = [
  "Oi! Eu lanço gastos e receitas no *Tudo em dia* e respondo como está o seu mês.",
  "",
  "*Para lançar:* mande o valor e o que foi",
  "   ex.: _45,90 mercado_",
  "*fatura* — quanto você deve nos cartões este mês",
  "*fatura nubank* — detalhes de um cartão",
  "*contas* — contas que faltam pagar este mês",
  "*sobra* — quanto sobra no mês",
  "*cancelar* — desiste do lançamento em andamento",
].join("\n")

const RODAPE = "\n\n_cancelar_ para desistir"

function listar(opcoes: Opcao[]): string {
  return opcoes.map((o, i) => `${i + 1} · ${o.nome}`).join("\n")
}

function ddmm(data: string): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`
}

function mesComMaiuscula(c: Competencia): string {
  const s = formatarCompetencia(c)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const OPCOES_TIPO: (Opcao & { id: TipoLancamento })[] = [
  { id: "cartao", nome: "Cartão de crédito" },
  { id: "mensal", nome: "Conta mensal (repete todo mês)" },
  { id: "unica", nome: "Conta só deste mês" },
  { id: "receita", nome: "Receita (dinheiro que entrou)" },
]

// ---------------------------------------------------------------------------
// Conversa
// ---------------------------------------------------------------------------

function perguntar(etapa: Etapa, rascunho: Rascunho, pergunta: string, opcoes?: Opcao[]): Resultado {
  return {
    estado: { etapa, rascunho: { ...rascunho, pergunta, opcoes } },
    resposta: opcoes ? `${pergunta}\n${listar(opcoes)}${RODAPE}` : `${pergunta}${RODAPE}`,
  }
}

function naoEntendi(estado: Estado): Resultado {
  const r = estado.rascunho!
  const opcoes = r.opcoes ? `\n${listar(r.opcoes)}` : ""
  return { estado, resposta: `Não entendi. ${r.pergunta}${opcoes}${RODAPE}` }
}

function concluir(resposta: string): Resultado {
  return { estado: ESTADO_INICIAL, resposta }
}

export async function responder(
  estado: Estado,
  texto: string,
  ctx: Contexto,
  dados: DadosDoUsuario,
): Promise<Resultado> {
  const t = normalizar(texto)

  if (["cancelar", "cancela", "sair", "parar"].includes(t)) {
    return concluir(estado.etapa === "livre" ? "Nada em andamento. Mande _ajuda_ para ver o que eu faço." : "Ok, cancelei. Nada foi lançado.")
  }

  if (estado.etapa === "livre" || !estado.rascunho) return comandoLivre(texto, ctx, dados)

  const r = estado.rascunho
  const moeda = (v: number) => formatarMoeda(v, ctx.moeda)

  switch (estado.etapa) {
    case "descricao": {
      if (!texto.trim()) return naoEntendi(estado)
      return perguntarTipo({ ...r, descricao: texto.trim() }, ctx)
    }

    case "tipo": {
      const escolha = lerOpcao(texto, OPCOES_TIPO) as (Opcao & { id: TipoLancamento }) | null
      if (!escolha) return naoEntendi(estado)
      const comTipo: Rascunho = { ...r, tipo: escolha.id }
      if (escolha.id === "cartao") return perguntarCartao(comTipo, dados)
      if (escolha.id === "receita") {
        return perguntar("tipo_receita", comTipo, "Essa entrada se repete todo mês?", [
          { id: "sim", nome: "Sim, todo mês (ex.: salário)" },
          { id: "nao", nome: "Não, só esta vez" },
        ])
      }
      return perguntarCategoria(comTipo, dados)
    }

    case "cartao": {
      const escolha = lerOpcao(texto, r.opcoes ?? [])
      if (!escolha) return naoEntendi(estado)
      const cartoes = await dados.cartoes()
      const cartao = cartoes.find((c) => c.id === escolha.id)
      if (!cartao) return concluir("Esse cartão não existe mais no app. Comece de novo, por favor.")
      return perguntarParcelas({ ...r, cartaoId: cartao.id, cartaoNome: cartao.nome })
    }

    case "parcelas": {
      const parcelas = lerParcelas(texto)
      if (!parcelas) return naoEntendi(estado)
      const cartao = (await dados.cartoes()).find((c) => c.id === r.cartaoId)
      if (!cartao) return concluir("Esse cartão não existe mais no app. Comece de novo, por favor.")
      const mesFatura = mesDaFatura(cartao, ctx.hoje)
      const vence = dataNoMes(mesFatura, cartao.dia_vencimento)
      return perguntar(
        "mes_fatura",
        { ...r, parcelas, mesFatura },
        `Vai para a fatura de *${mesComMaiuscula(mesFatura)}* (vence ${ddmm(vence)}). Certo?`,
        [{ id: "sim", nome: "Sim" }, { id: "nao", nome: "Outro mês" }],
      )
    }

    case "mes_fatura": {
      const sim = lerSimNao(texto)
      if (sim === null) return naoEntendi(estado)
      if (!sim) return perguntar("mes_fatura_outro", r, "Qual mês? (ex.: _12_ ou _12/2026_)")
      return salvarCompra(r, ctx, dados)
    }

    case "mes_fatura_outro": {
      const mes = lerMes(texto, ctx.hoje)
      if (!mes) return naoEntendi(estado)
      return salvarCompra({ ...r, mesFatura: mes }, ctx, dados)
    }

    case "categoria": {
      const escolha = lerOpcao(texto, r.opcoes ?? [])
      if (!escolha) return naoEntendi(estado)
      return perguntarDia({ ...r, categoriaId: escolha.id, categoriaNome: escolha.id ? escolha.nome : undefined })
    }

    case "dia": {
      const dia = lerDia(texto, ctx.hoje)
      if (!dia) return naoEntendi(estado)
      return perguntar("pago", { ...r, dia }, "Já está paga este mês?", [
        { id: "sim", nome: "Sim, já paguei" },
        { id: "nao", nome: "Não, ainda vou pagar" },
      ])
    }

    case "pago": {
      const pago = lerSimNao(texto)
      if (pago === null) return naoEntendi(estado)
      const vencimento = dataNoMes(ctx.hoje.slice(0, 7), r.dia!)
      const mensal = r.tipo === "mensal"
      await dados.lancarConta({
        nome: r.descricao!,
        valor: r.valor,
        vencimento,
        categoriaId: r.categoriaId ?? null,
        recorrencia: mensal ? "recorrente" : "eventual",
        pago,
      })
      const categoria = r.categoriaNome ? ` em ${r.categoriaNome}` : ""
      const situacao = pago ? "já paga" : "pendente"
      return concluir(
        mensal
          ? `✅ Conta mensal criada${categoria}: *${r.descricao}* — ${moeda(r.valor)}, vence todo dia ${r.dia}. Este mês: ${situacao}.`
          : `✅ Conta lançada${categoria}: *${r.descricao}* — ${moeda(r.valor)}, vence ${ddmm(vencimento)}. ${situacao.charAt(0).toUpperCase() + situacao.slice(1)}.`,
      )
    }

    case "tipo_receita": {
      const recorrente = lerSimNao(texto)
      if (recorrente === null) return naoEntendi(estado)
      await dados.lancarReceita({ nome: r.descricao!, valor: r.valor, data: ctx.hoje, recorrente })
      return concluir(
        recorrente
          ? `✅ Receita mensal criada: *${r.descricao}* — ${moeda(r.valor)}, entra todo mês a partir de ${formatarCompetencia(ctx.hoje.slice(0, 7))}.`
          : `✅ Receita lançada: *${r.descricao}* — ${moeda(r.valor)} em ${ddmm(ctx.hoje)}.`,
      )
    }
  }
}

function perguntarTipo(r: Rascunho, ctx: Contexto): Resultado {
  return perguntar("tipo", r, `${formatarMoeda(r.valor, ctx.moeda)} — *${r.descricao}*. O que é?`, OPCOES_TIPO)
}

async function perguntarCartao(r: Rascunho, dados: DadosDoUsuario): Promise<Resultado> {
  const cartoes = await dados.cartoes()
  if (cartoes.length === 0) {
    return concluir("Você ainda não tem cartão cadastrado. Cadastre em *Cartões* no app e mande o gasto de novo.")
  }
  if (cartoes.length === 1) {
    return perguntarParcelas({ ...r, cartaoId: cartoes[0].id, cartaoNome: cartoes[0].nome })
  }
  return perguntar("cartao", r, "Qual cartão?", cartoes.map((c) => ({ id: c.id, nome: c.nome })))
}

function perguntarParcelas(r: Rascunho): Resultado {
  return perguntar("parcelas", r, `*${r.cartaoNome}*. Em quantas vezes? (_1_ = à vista)`)
}

async function perguntarCategoria(r: Rascunho, dados: DadosDoUsuario): Promise<Resultado> {
  const categorias = await dados.categorias()
  if (categorias.length === 0) return perguntarDia({ ...r, categoriaId: null })
  const opcoes: Opcao[] = [...categorias.map((c) => ({ id: c.id, nome: c.nome })), { id: null, nome: "Sem categoria" }]
  return perguntar("categoria", r, "Qual categoria?", opcoes)
}

function perguntarDia(r: Rascunho): Resultado {
  return perguntar("dia", r, "Vence em que dia do mês? (_1_ a _31_, ou _hoje_)")
}

async function salvarCompra(r: Rascunho, ctx: Contexto, dados: DadosDoUsuario): Promise<Resultado> {
  await dados.lancarCompraCartao({
    cartaoId: r.cartaoId!,
    descricao: r.descricao!,
    valorTotal: r.valor,
    parcelas: r.parcelas!,
    mesInicial: r.mesFatura!,
  })
  const mes = formatarCompetencia(r.mesFatura!)
  const moeda = (v: number) => formatarMoeda(v, ctx.moeda)
  if (r.parcelas === 1) {
    return concluir(`✅ Lançado no *${r.cartaoNome}*: ${r.descricao} — ${moeda(r.valor)}, na fatura de ${mes}.`)
  }
  const parcela = Math.round((r.valor / r.parcelas!) * 100) / 100
  return concluir(
    `✅ Lançado no *${r.cartaoNome}*: ${r.descricao} — ${r.parcelas}x de ${moeda(parcela)}, a partir da fatura de ${mes}.`,
  )
}

// ---------------------------------------------------------------------------
// Comandos fora de um lançamento
// ---------------------------------------------------------------------------

async function comandoLivre(texto: string, ctx: Contexto, dados: DadosDoUsuario): Promise<Resultado> {
  const t = normalizar(texto)
  const competencia = ctx.hoje.slice(0, 7)

  if (/^faturas?\b/.test(t)) {
    const nome = t.replace(/^faturas?\s*(do|da|de)?\s*/, "").trim()
    return concluir(nome ? await faturaDoCartao(nome, competencia, ctx, dados) : await faturas(competencia, ctx, dados))
  }
  if (/^contas?\b/.test(t)) return concluir(await contasPendentes(competencia, ctx, dados))
  if (/^(sobra|saldo|resumo)\b/.test(t)) return concluir(await sobra(competencia, ctx, dados))

  const lido = lerValor(texto)
  if (lido) {
    const r: Rascunho = { valor: lido.valor }
    if (!lido.resto) {
      return perguntar("descricao", r, `O que foi esse valor de ${formatarMoeda(lido.valor, ctx.moeda)}? (ex.: _mercado_)`)
    }
    return perguntarTipo({ ...r, descricao: lido.resto }, ctx)
  }

  return concluir(AJUDA)
}

async function faturas(competencia: Competencia, ctx: Contexto, dados: DadosDoUsuario): Promise<string> {
  const { parcelas } = await dados.resumoDoMes(competencia)
  const pendentes = parcelas.filter((p) => p.status === "pendente")
  const mes = mesComMaiuscula(competencia)
  if (pendentes.length === 0) return `Nenhuma fatura para pagar em ${mes}. 🎉`

  const porCartao = new Map<string, number>()
  for (const p of pendentes) porCartao.set(p.cartaoNome, (porCartao.get(p.cartaoNome) ?? 0) + p.valor)
  const total = pendentes.reduce((acc, p) => acc + p.valor, 0)
  const linhas = [...porCartao.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nome, valor]) => `${nome}: ${formatarMoeda(valor, ctx.moeda)}`)
  return [`*Faturas de ${mes}* (falta pagar)`, ...linhas, `*Total: ${formatarMoeda(total, ctx.moeda)}*`].join("\n")
}

async function faturaDoCartao(nome: string, competencia: Competencia, ctx: Contexto, dados: DadosDoUsuario): Promise<string> {
  const cartoes = await dados.cartoes()
  const achados = cartoes.filter((c) => normalizar(c.nome).includes(nome))
  if (achados.length !== 1) {
    const lista = cartoes.map((c) => `• ${c.nome}`).join("\n")
    return cartoes.length === 0
      ? "Você ainda não tem cartão cadastrado no app."
      : `Não achei um cartão "${nome}". Seus cartões:\n${lista}`
  }
  const cartao = achados[0]
  const [{ parcelas }, emAberto] = await Promise.all([dados.resumoDoMes(competencia), dados.pendenteTotalPorCartao()])
  const doCartao = parcelas.filter((p) => p.cartaoId === cartao.id && p.status === "pendente")
  const mes = mesComMaiuscula(competencia)
  const total = doCartao.reduce((acc, p) => acc + p.valor, 0)
  const itens = doCartao
    .sort((a, b) => b.valor - a.valor)
    .map((p) => `• ${p.descricao}${p.total > 1 ? ` (${p.numero}/${p.total})` : ""} — ${formatarMoeda(p.valor, ctx.moeda)}`)
  const cabecalho = `*${cartao.nome} — ${mes}*`
  const corpo = doCartao.length ? [...itens, `*Falta pagar: ${formatarMoeda(total, ctx.moeda)}*`] : ["Nada para pagar este mês."]
  return [cabecalho, ...corpo, "", `Em aberto contando os próximos meses: ${formatarMoeda(emAberto.get(cartao.id) ?? 0, ctx.moeda)}`].join("\n")
}

async function contasPendentes(competencia: Competencia, ctx: Contexto, dados: DadosDoUsuario): Promise<string> {
  const { compromissos } = await dados.resumoDoMes(competencia)
  const pendentes = compromissos.filter((c) => c.status === "pendente").sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  const mes = mesComMaiuscula(competencia)
  if (pendentes.length === 0) return `Nenhuma conta pendente em ${mes}. 🎉`
  const total = pendentes.reduce((acc, c) => acc + c.valor, 0)
  const linhas = pendentes.map((c) => `• ${ddmm(c.vencimento)} ${c.nome} — ${formatarMoeda(c.valor, ctx.moeda)}`)
  return [`*Contas pendentes de ${mes}*`, ...linhas, `*Total: ${formatarMoeda(total, ctx.moeda)}*`].join("\n")
}

/** Mesma conta do Painel: entradas − (todos os compromissos + todas as parcelas do mês). */
async function sobra(competencia: Competencia, ctx: Contexto, dados: DadosDoUsuario): Promise<string> {
  const { receitas, compromissos, parcelas } = await dados.resumoDoMes(competencia)
  const moeda = (v: number) => formatarMoeda(v, ctx.moeda)
  const totalContas = compromissos.reduce((acc, c) => acc + c.valor, 0)
  const totalCartao = parcelas.reduce((acc, p) => acc + p.valor, 0)
  const faltaPagar =
    compromissos.filter((c) => c.status === "pendente").reduce((acc, c) => acc + c.valor, 0)
    + parcelas.filter((p) => p.status === "pendente").reduce((acc, p) => acc + p.valor, 0)
  const saldo = receitas - totalContas - totalCartao
  return [
    `*${mesComMaiuscula(competencia)}*`,
    `Entradas: ${moeda(receitas)}`,
    `Comprometido: ${moeda(totalContas + totalCartao)} (contas ${moeda(totalContas)} + cartão ${moeda(totalCartao)})`,
    `*Sobra: ${moeda(saldo)}*`,
    `Falta pagar: ${moeda(faltaPagar)}`,
  ].join("\n")
}
