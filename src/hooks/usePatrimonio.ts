import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { Moeda, Patrimonio, TipoPatrimonio } from "@/types/database"

const KEY = ["patrimonio"]

/**
 * Cada atualização do usuário insere uma nova linha (histórico), então o valor
 * "atual" de cada tipo é o registro mais recente, e o histórico completo alimenta
 * o gráfico de evolução.
 */
export function usePatrimonioHistorico() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patrimonio")
        .select("*")
        .order("atualizado_em", { ascending: true })
      if (error) throw error
      return data as Patrimonio[]
    },
  })
}

export function useAtualizarPatrimonio() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (
      { tipo, valor, moeda }: { tipo: TipoPatrimonio; valor: number; moeda: Moeda }
    ) => {
      if (!user) throw new Error("Usuário não autenticado")
      const { error } = await supabase.from("patrimonio").insert({
        tipo,
        valor,
        moeda,
        user_id: user.id,
        atualizado_em: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useAtualizarLancamentoPatrimonio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      { id, tipo, valor, moeda }: { id: string; tipo: TipoPatrimonio; valor: number; moeda: Moeda }
    ) => {
      const { error } = await supabase.from("patrimonio").update({ tipo, valor, moeda }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteLancamentoPatrimonio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patrimonio").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/** Moedas com pelo menos um registro no histórico, na ordem em que apareceram. */
export function moedasNoHistorico(historico: Patrimonio[]): Moeda[] {
  const vistas = new Set<Moeda>()
  for (const registro of historico) vistas.add(registro.moeda)
  return Array.from(vistas)
}

/** Último valor lançado para um tipo numa moeda específica (cada lançamento é o total atualizado, não incremento). */
export function valorAtualPorTipo(historico: Patrimonio[], tipo: TipoPatrimonio, moeda: Moeda): number {
  const registros = historico.filter((p) => p.tipo === tipo && p.moeda === moeda)
  if (registros.length === 0) return 0
  return registros[registros.length - 1].valor
}
