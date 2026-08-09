import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { Receita, TipoReceita } from "@/types/database"
import { competenciaAdjacente, type Competencia } from "@/lib/competencia"

const KEY = ["receitas"]

export interface ReceitaInput {
  nome: string
  valor: number
  data: string
  recorrente: boolean
  tipo: TipoReceita
}

/**
 * Receitas do mês: data dentro da competência, OU recorrentes cadastradas em mês
 * anterior/igual e ainda válidas naquele mês (valido_ate nulo ou >= início do mês —
 * permite preservar o valor histórico quando o valor de uma recorrente muda).
 */
export function useReceitas(competencia: Competencia) {
  return useQuery({
    queryKey: [...KEY, competencia],
    queryFn: async () => {
      const [ano, mes] = competencia.split("-").map(Number)
      const ultimoDia = new Date(ano, mes, 0).getDate()
      const inicioMes = `${competencia}-01`
      const fimMes = `${competencia}-${String(ultimoDia).padStart(2, "0")}`
      const { data, error } = await supabase
        .from("receitas")
        .select("*")
        .or(
          `and(data.gte.${inicioMes},data.lte.${fimMes},recorrente.eq.false),`
          + `and(recorrente.eq.true,data.lte.${fimMes},or(valido_ate.is.null,valido_ate.gte.${inicioMes}))`
        )
        .order("data")
      if (error) throw error
      return data as Receita[]
    },
  })
}

export function useCreateReceita() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: ReceitaInput) => {
      if (!user) throw new Error("Usuário não autenticado")
      const { error } = await supabase.from("receitas").insert({ ...input, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateReceita() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: ReceitaInput & { id: string }) => {
      const { error } = await supabase.from("receitas").update(input).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/**
 * Edita uma receita recorrente preservando o histórico: em vez de sobrescrever a
 * linha existente, fecha-a no fim do mês anterior à competência efetiva da mudança
 * (valido_ate) e insere uma linha nova com o valor atualizado a partir dali. Assim,
 * meses passados continuam mostrando o valor antigo.
 */
export function useEditarReceitaRecorrente() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (
      { id, competenciaEfetiva, ...input }: ReceitaInput & { id: string; competenciaEfetiva: Competencia }
    ) => {
      if (!user) throw new Error("Usuário não autenticado")

      const mesAnterior = competenciaAdjacente(competenciaEfetiva, -1)
      const [anoAnt, mesAnt] = mesAnterior.split("-").map(Number)
      const ultimoDiaMesAnterior = new Date(anoAnt, mesAnt, 0).getDate()
      const validoAte = `${mesAnterior}-${String(ultimoDiaMesAnterior).padStart(2, "0")}`

      const { error: fecharError } = await supabase
        .from("receitas")
        .update({ valido_ate: validoAte })
        .eq("id", id)
      if (fecharError) throw fecharError

      const { error: insertError } = await supabase.from("receitas").insert({
        ...input,
        data: `${competenciaEfetiva}-01`,
        user_id: user.id,
      })
      if (insertError) throw insertError
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteReceita() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("receitas").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
