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

      const { data: original, error: fetchError } = await supabase
        .from("receitas")
        .select("data, valido_ate")
        .eq("id", id)
        .single()
      if (fetchError) throw fetchError

      // A linha começou nesta competência (ou depois): não há passado a preservar, edita no lugar.
      if (original.data >= `${competenciaEfetiva}-01`) {
        const { error } = await supabase
          .from("receitas")
          .update({ ...input, data: `${competenciaEfetiva}-01` })
          .eq("id", id)
        if (error) throw error
        return
      }

      const { error: fecharError } = await supabase
        .from("receitas")
        .update({ valido_ate: validoAte })
        .eq("id", id)
      if (fecharError) throw fecharError

      // Preserva o fim de validade original (linha já fechada por outra edição) pra não
      // estender a nova versão por cima de meses que pertencem a versões posteriores.
      const { error: insertError } = await supabase.from("receitas").insert({
        ...input,
        data: `${competenciaEfetiva}-01`,
        valido_ate: original.valido_ate,
        user_id: user.id,
      })
      if (insertError) throw insertError
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/** Último dia do mês anterior à competência, como 'YYYY-MM-DD'. */
function fimDoMesAnterior(competencia: Competencia): string {
  const anterior = competenciaAdjacente(competencia, -1)
  const [ano, mes] = anterior.split("-").map(Number)
  return `${anterior}-${String(new Date(ano, mes, 0).getDate()).padStart(2, "0")}`
}

/**
 * Exclui uma receita. Se for recorrente, apaga só da competência atual em diante: fecha a
 * linha no fim do mês anterior (valido_ate) em vez de apagá-la, para os meses passados
 * continuarem mostrando a receita. Se a linha começou nesta competência (ou depois), não
 * há passado a preservar e ela é apagada de vez. Versões posteriores da mesma receita
 * (mesmo nome, criadas por edições de valor) também são apagadas.
 */
export function useDeleteReceita() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ receita, competencia }: { receita: Receita; competencia: Competencia }) => {
      if (receita.recorrente) {
        const inicioMes = `${competencia}-01`

        const { error: posterioresError } = await supabase
          .from("receitas")
          .delete()
          .eq("recorrente", true)
          .eq("nome", receita.nome)
          .gt("data", receita.data)
          .gte("data", inicioMes)
        if (posterioresError) throw posterioresError

        if (receita.data < inicioMes) {
          const { error } = await supabase
            .from("receitas")
            .update({ valido_ate: fimDoMesAnterior(competencia) })
            .eq("id", receita.id)
          if (error) throw error
          return
        }
      }
      const { error } = await supabase.from("receitas").delete().eq("id", receita.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
