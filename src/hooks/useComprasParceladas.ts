import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { CompraParcelada, Parcela } from "@/types/database"
import type { Competencia } from "@/lib/competencia"

const KEY = ["compras_parceladas"]
const PARCELAS_KEY = ["parcelas"]

export interface CompraParceladaInput {
  cartao_id: string
  descricao: string
  valor_total: number
  quantidade_parcelas: number
  mes_inicial: string
  pessoas: number
}

export function useComprasParceladas(cartaoId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, cartaoId],
    enabled: !!cartaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras_parceladas")
        .select("*")
        .eq("cartao_id", cartaoId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as CompraParcelada[]
    },
  })
}

function calcularValorParcela(input: Pick<CompraParceladaInput, "valor_total" | "quantidade_parcelas" | "pessoas">) {
  return Math.round((input.valor_total / input.quantidade_parcelas / input.pessoas) * 100) / 100
}

/** Cria a compra parcelada. O trigger no banco gera as parcelas automaticamente. */
export function useCreateCompraParcelada() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CompraParceladaInput) => {
      const valor_parcela = calcularValorParcela(input)
      const { error } = await supabase.from("compras_parceladas").insert({ ...input, valor_parcela })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY })
      queryClient.invalidateQueries({ queryKey: PARCELAS_KEY })
    },
  })
}

/** Edita a compra parcelada. O trigger no banco recalcula/regenera as parcelas
 * (preservando o status 'pago' das que continuam existindo). */
export function useUpdateCompraParcelada() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: CompraParceladaInput & { id: string }) => {
      const valor_parcela = calcularValorParcela(input)
      const { error } = await supabase.from("compras_parceladas").update({ ...input, valor_parcela }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY })
      queryClient.invalidateQueries({ queryKey: PARCELAS_KEY })
    },
  })
}

export function useDeleteCompraParcelada() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compras_parceladas").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY })
      queryClient.invalidateQueries({ queryKey: PARCELAS_KEY })
    },
  })
}

export function useParcelasDaCompra(compraId: string | undefined) {
  return useQuery({
    queryKey: [...PARCELAS_KEY, "compra", compraId],
    enabled: !!compraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*")
        .eq("compra_parcelada_id", compraId!)
        .order("numero_parcela")
      if (error) throw error
      return data as Parcela[]
    },
  })
}

/** Todas as parcelas (de todos os cartões) que caem numa competência — usadas no cálculo do saldo do mês. */
export function useParcelasDaCompetencia(competencia: Competencia) {
  return useQuery({
    queryKey: [...PARCELAS_KEY, "competencia", competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("*, compras_parceladas(descricao, cartao_id, cartoes(nome, dia_vencimento))")
        .eq("competencia", competencia)
      if (error) throw error
      return data as (Parcela & {
        compras_parceladas: {
          descricao: string
          cartao_id: string
          cartoes: { nome: string; dia_vencimento: number }
        } | null
      })[]
    },
  })
}

export interface ResumoParcelas {
  pagas: number
  total: number
  valorPago: number
  valorTotal: number
}

/** Progresso (nº e valor pago/total) de cada compra parcelada de um cartão, numa única consulta. */
export function useResumoParcelasPorCartao(cartaoId: string | undefined) {
  return useQuery({
    queryKey: [...PARCELAS_KEY, "resumo-cartao", cartaoId],
    enabled: !!cartaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("compra_parcelada_id, valor, status, compras_parceladas!inner(cartao_id)")
        .eq("compras_parceladas.cartao_id", cartaoId!)
      if (error) throw error

      const porCompra = new Map<string, ResumoParcelas>()
      for (const parcela of data as unknown as { compra_parcelada_id: string; valor: number; status: "pago" | "pendente" }[]) {
        const atual = porCompra.get(parcela.compra_parcelada_id) ?? { pagas: 0, total: 0, valorPago: 0, valorTotal: 0 }
        atual.total += 1
        atual.valorTotal += parcela.valor
        if (parcela.status === "pago") {
          atual.pagas += 1
          atual.valorPago += parcela.valor
        }
        porCompra.set(parcela.compra_parcelada_id, atual)
      }
      return porCompra
    },
  })
}

/** Soma das parcelas pendentes (todos os meses) por cartão — usada para calcular o limite disponível. */
export function useTotalPendentePorCartao() {
  return useQuery({
    queryKey: [...PARCELAS_KEY, "pendente-por-cartao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelas")
        .select("valor, compras_parceladas(cartao_id)")
        .eq("status", "pendente")
      if (error) throw error
      const porCartao = new Map<string, number>()
      for (const parcela of data as unknown as { valor: number; compras_parceladas: { cartao_id: string } | null }[]) {
        const cartaoId = parcela.compras_parceladas?.cartao_id
        if (!cartaoId) continue
        porCartao.set(cartaoId, (porCartao.get(cartaoId) ?? 0) + parcela.valor)
      }
      return porCartao
    },
  })
}

export function useMarcarParcelaPaga() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "pago" | "pendente" }) => {
      const { error } = await supabase.from("parcelas").update({ status }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PARCELAS_KEY }),
  })
}

/** Marca todas as parcelas de uma fatura (mesmo cartão + mês) como pagas/pendentes de uma vez. */
export function useMarcarFaturaPaga() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: "pago" | "pendente" }) => {
      const { error } = await supabase.from("parcelas").update({ status }).in("id", ids)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PARCELAS_KEY }),
  })
}
