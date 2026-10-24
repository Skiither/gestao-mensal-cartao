// Implementação de DadosDoUsuario no Supabase. O bot usa a chave service_role, que ignora
// RLS — por isso TODA consulta aqui filtra pelo usuário explicitamente.
import type { SupabaseClient } from "@supabase/supabase-js"
import { recorrentesFaltando } from "../../src/lib/recorrentes.js"
import type { CompromissoFinanceiro, Database, Status } from "../../src/types/database.js"
import type { DadosDoUsuario, ResumoMes } from "./conversa.js"

export type Banco = SupabaseClient<Database>

function ultimoDia(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number)
  return `${competencia}-${String(new Date(ano, mes, 0).getDate()).padStart(2, "0")}`
}

export function dadosDoUsuario(db: Banco, userId: string): DadosDoUsuario {
  /** Mesma geração preguiçosa de contas recorrentes que o app faz ao abrir um mês. */
  async function garantirRecorrentes(competencia: string) {
    const { data, error } = await db
      .from("compromissos_financeiros")
      .select("*")
      .eq("user_id", userId)
      .eq("recorrencia", "recorrente")
    if (error) throw error
    const novos = recorrentesFaltando(data as CompromissoFinanceiro[], userId, competencia)
    if (novos.length > 0) {
      const { error: insertError } = await db.from("compromissos_financeiros").insert(novos)
      if (insertError) throw insertError
    }
  }

  return {
    async cartoes() {
      const { data, error } = await db
        .from("cartoes")
        .select("id, nome, dia_fechamento, dia_vencimento")
        .eq("user_id", userId)
        .order("nome")
      if (error) throw error
      return data
    },

    async categorias() {
      const { data, error } = await db.from("categorias").select("id, nome").eq("user_id", userId).order("nome")
      if (error) throw error
      return data
    },

    async resumoDoMes(competencia) {
      await garantirRecorrentes(competencia)
      const inicioMes = `${competencia}-01`
      const fimMes = ultimoDia(competencia)

      const [receitas, compromissos, parcelas] = await Promise.all([
        // Mesmo filtro de useReceitas: avulsas do mês + recorrentes ainda válidas no mês.
        db
          .from("receitas")
          .select("valor")
          .eq("user_id", userId)
          .or(
            `and(data.gte.${inicioMes},data.lte.${fimMes},recorrente.eq.false),`
            + `and(recorrente.eq.true,data.lte.${fimMes},or(valido_ate.is.null,valido_ate.gte.${inicioMes}))`,
          ),
        db
          .from("compromissos_financeiros")
          .select("nome, valor, vencimento, status")
          .eq("user_id", userId)
          .eq("competencia", competencia),
        db
          .from("parcelas")
          .select(
            "valor, status, numero_parcela, compras_parceladas!inner(descricao, quantidade_parcelas, cartao_id, cartoes!inner(nome, user_id))",
          )
          .eq("competencia", competencia)
          .eq("compras_parceladas.cartoes.user_id", userId),
      ])
      if (receitas.error) throw receitas.error
      if (compromissos.error) throw compromissos.error
      if (parcelas.error) throw parcelas.error

      const linhasParcelas = parcelas.data as unknown as {
        valor: number
        status: Status
        numero_parcela: number
        compras_parceladas: {
          descricao: string
          quantidade_parcelas: number
          cartao_id: string
          cartoes: { nome: string }
        }
      }[]

      const resumo: ResumoMes = {
        receitas: receitas.data.reduce((acc, r) => acc + Number(r.valor), 0),
        compromissos: compromissos.data.map((c) => ({ ...c, valor: Number(c.valor) })),
        parcelas: linhasParcelas.map((p) => ({
          valor: Number(p.valor),
          status: p.status,
          descricao: p.compras_parceladas.descricao,
          numero: p.numero_parcela,
          total: p.compras_parceladas.quantidade_parcelas,
          cartaoId: p.compras_parceladas.cartao_id,
          cartaoNome: p.compras_parceladas.cartoes.nome,
        })),
      }
      return resumo
    },

    async pendenteTotalPorCartao() {
      const { data, error } = await db
        .from("parcelas")
        .select("valor, compras_parceladas!inner(cartao_id, cartoes!inner(user_id))")
        .eq("status", "pendente")
        .eq("compras_parceladas.cartoes.user_id", userId)
      if (error) throw error
      const porCartao = new Map<string, number>()
      for (const p of data as unknown as { valor: number; compras_parceladas: { cartao_id: string } }[]) {
        const id = p.compras_parceladas.cartao_id
        porCartao.set(id, (porCartao.get(id) ?? 0) + Number(p.valor))
      }
      return porCartao
    },

    async lancarCompraCartao({ cartaoId, descricao, valorTotal, parcelas, mesInicial }) {
      // compras_parceladas não tem user_id: confere que o cartão é mesmo deste usuário.
      const { data: cartao, error: cartaoError } = await db
        .from("cartoes")
        .select("id")
        .eq("id", cartaoId)
        .eq("user_id", userId)
        .maybeSingle()
      if (cartaoError) throw cartaoError
      if (!cartao) throw new Error("Cartão não pertence ao usuário")

      // Mesmo cálculo de calcularValorParcela (useComprasParceladas), com 1 pessoa.
      const { error } = await db.from("compras_parceladas").insert({
        cartao_id: cartaoId,
        descricao,
        valor_total: valorTotal,
        quantidade_parcelas: parcelas,
        valor_parcela: Math.round((valorTotal / parcelas) * 100) / 100,
        mes_inicial: mesInicial,
        pessoas: 1,
      })
      if (error) throw error
    },

    async lancarConta({ nome, valor, vencimento, categoriaId, recorrencia, pago }) {
      // Mesmo formato de useCreateCompromisso: competência derivada do vencimento.
      const { error } = await db.from("compromissos_financeiros").insert({
        user_id: userId,
        nome,
        valor,
        vencimento,
        categoria_id: categoriaId,
        recorrencia,
        competencia: vencimento.slice(0, 7),
        serie_id: crypto.randomUUID(),
        status: pago ? "pago" : "pendente",
      })
      if (error) throw error
    },

    async lancarReceita({ nome, valor, data, recorrente }) {
      const { error } = await db.from("receitas").insert({
        user_id: userId,
        nome,
        valor,
        data,
        recorrente,
        tipo: recorrente ? "recorrente" : "extraordinaria",
      })
      if (error) throw error
    },
  }
}
