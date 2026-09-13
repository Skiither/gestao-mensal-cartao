import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { CompromissoFinanceiro, Recorrencia, Status } from "@/types/database"
import { proximaCompetencia, type Competencia } from "@/lib/competencia"

const KEY = ["compromissos"]

export interface CompromissoInput {
  nome: string
  valor: number
  vencimento: string
  categoria_id: string | null
  recorrencia: Recorrencia
}

/** Deriva a competência ('YYYY-MM') a partir da data de vencimento. */
function competenciaDoVencimento(vencimento: string): string {
  return vencimento.slice(0, 7)
}

function diaDoMesClamped(vencimento: string, competenciaAlvo: string): string {
  const diaVencimento = Number(vencimento.split("-")[2])
  const [ano, mes] = competenciaAlvo.split("-").map(Number)
  const ultimoDiaDoMes = new Date(ano, mes, 0).getDate()
  const dia = Math.min(diaVencimento, ultimoDiaDoMes)
  return `${competenciaAlvo}-${String(dia).padStart(2, "0")}`
}

/**
 * Garante que toda série recorrente ativa tenha uma linha até `competencia` (inclusive),
 * gerando os meses que faltarem a partir da última linha conhecida de cada série
 * (mesmo `serie_id`), preservando o "dia" de vencimento. Idempotente: só insere o que faltar.
 */
async function garantirRecorrentesAteCompetencia(userId: string, competencia: Competencia) {
  const { data, error } = await supabase
    .from("compromissos_financeiros")
    .select("*")
    .eq("recorrencia", "recorrente")
    .order("competencia", { ascending: true })
  if (error) throw error

  const linhas = data as CompromissoFinanceiro[]
  // serie_id ainda não existe no banco (migração pendente) — sem ele não dá pra saber com
  // segurança quais linhas pertencem à mesma série, então não gera nada até a coluna existir
  // (gerar errado aqui criaria duplicatas).
  if (linhas.some((c) => !c.serie_id)) return

  const porSerie = new Map<string, CompromissoFinanceiro>()
  for (const c of linhas) {
    porSerie.set(c.serie_id, c) // fica com a de maior competência (lista já vem ordenada asc)
  }

  const novos: Array<Omit<CompromissoFinanceiro, "id" | "created_at">> = []
  for (const ultima of porSerie.values()) {
    if (ultima.competencia >= competencia) continue

    let template = ultima
    let comp = proximaCompetencia(template.competencia)
    while (comp <= competencia) {
      const novo = {
        user_id: userId,
        categoria_id: template.categoria_id,
        nome: template.nome,
        valor: template.valor,
        vencimento: diaDoMesClamped(template.vencimento, comp),
        competencia: comp,
        recorrencia: "recorrente" as const,
        essencial: template.essencial,
        serie_id: template.serie_id,
        status: "pendente" as Status,
      }
      novos.push(novo)
      template = { ...template, ...novo }
      comp = proximaCompetencia(comp)
    }
  }

  if (novos.length > 0) {
    const { error: insertError } = await supabase.from("compromissos_financeiros").insert(novos)
    if (insertError) throw insertError
  }
}

export function useCompromissos(competencia: Competencia) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [...KEY, competencia],
    enabled: !!user,
    queryFn: async () => {
      await garantirRecorrentesAteCompetencia(user!.id, competencia)

      const { data, error } = await supabase
        .from("compromissos_financeiros")
        .select("*")
        .eq("competencia", competencia)
        .order("vencimento")
      if (error) throw error
      return data as CompromissoFinanceiro[]
    },
  })
}

/** Todos os compromissos do usuário, em qualquer competência (usado para agrupar por categoria em Categorias). */
export function useTodosCompromissos() {
  return useQuery({
    queryKey: [...KEY, "todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compromissos_financeiros")
        .select("*")
        .order("competencia", { ascending: false })
        .order("vencimento", { ascending: false })
      if (error) throw error
      return data as CompromissoFinanceiro[]
    },
  })
}

export function useCreateCompromisso() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: CompromissoInput) => {
      if (!user) throw new Error("Usuário não autenticado")
      const { error } = await supabase.from("compromissos_financeiros").insert({
        ...input,
        competencia: competenciaDoVencimento(input.vencimento),
        serie_id: crypto.randomUUID(),
        user_id: user.id,
        status: "pendente" as Status,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/**
 * Edita um compromisso. Se ele for recorrente (e já tiver `serie_id`), a edição também é
 * propagada para as linhas já existentes da mesma série a partir da competência original
 * (inclusive) em diante — nome, valor, categoria e o "dia" de vencimento (preservando a
 * competência de cada linha). Meses **anteriores** à linha editada nunca são tocados aqui:
 * só mudam se o usuário for lá e editar aquele mês diretamente. `status` (pago/pendente) de
 * cada linha também não é tocado pela propagação.
 */
export function useUpdateCompromisso() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      { original, ...input }: CompromissoInput & { original: CompromissoFinanceiro }
    ) => {
      const { error } = await supabase
        .from("compromissos_financeiros")
        .update({ ...input, competencia: competenciaDoVencimento(input.vencimento) })
        .eq("id", original.id)
      if (error) throw error

      if (original.recorrencia === "recorrente" && original.serie_id) {
        const { data: futuras, error: fetchError } = await supabase
          .from("compromissos_financeiros")
          .select("id, competencia")
          .eq("serie_id", original.serie_id)
          .neq("id", original.id)
          .gte("competencia", original.competencia)
        if (fetchError) throw fetchError

        for (const futura of (futuras ?? []) as Array<{ id: string; competencia: string }>) {
          const { error: propagarError } = await supabase
            .from("compromissos_financeiros")
            .update({
              nome: input.nome,
              valor: input.valor,
              categoria_id: input.categoria_id,
              vencimento: diaDoMesClamped(input.vencimento, futura.competencia),
            })
            .eq("id", futura.id)
          if (propagarError) throw propagarError
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/**
 * Exclui um compromisso. Para um recorrente, `escopo: "futuros"` também apaga as linhas já
 * geradas da mesma série a partir da competência dessa linha (inclusive) em diante — meses
 * anteriores (já pagos/históricos) nunca são tocados, o mesmo critério usado na propagação de
 * edição em `useUpdateCompromisso`.
 */
export function useDeleteCompromisso() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      { compromisso, escopo }: { compromisso: CompromissoFinanceiro; escopo: "unico" | "futuros" }
    ) => {
      if (escopo === "futuros" && compromisso.recorrencia === "recorrente" && compromisso.serie_id) {
        const { error } = await supabase
          .from("compromissos_financeiros")
          .delete()
          .eq("serie_id", compromisso.serie_id)
          .gte("competencia", compromisso.competencia)
        if (error) throw error
        return
      }
      const { error } = await supabase.from("compromissos_financeiros").delete().eq("id", compromisso.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/** Alterna o status do compromisso entre pago/pendente (reversível). A geração de meses
 * futuros para séries recorrentes acontece em `garantirRecorrentesAteCompetencia`, não aqui. */
export function useMarcarCompromissoPago() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      { compromisso, pago }: { compromisso: CompromissoFinanceiro; pago: boolean }
    ) => {
      const { error } = await supabase
        .from("compromissos_financeiros")
        .update({ status: pago ? "pago" : "pendente" })
        .eq("id", compromisso.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
