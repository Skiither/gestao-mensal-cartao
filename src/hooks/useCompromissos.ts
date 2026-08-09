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

export function useUpdateCompromisso() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: CompromissoInput & { id: string }) => {
      const { error } = await supabase
        .from("compromissos_financeiros")
        .update({ ...input, competencia: competenciaDoVencimento(input.vencimento) })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteCompromisso() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compromissos_financeiros").delete().eq("id", id)
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
