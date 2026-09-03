import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { Moeda, PatrimonioItem, TipoItemPatrimonio } from "@/types/database"

const KEY = ["patrimonio_itens"]

export interface ItemInput {
  tipo: TipoItemPatrimonio
  nome: string
  valor: number
  moeda: Moeda
}

export function usePatrimonioItens() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patrimonio_itens")
        .select("*")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true })
      if (error) throw error
      return data as PatrimonioItem[]
    },
  })
}

export function useCreatePatrimonioItem() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: ItemInput) => {
      if (!user) throw new Error("Usuário não autenticado")
      const { error } = await supabase.from("patrimonio_itens").insert({ ...input, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdatePatrimonioItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: ItemInput & { id: string }) => {
      const { error } = await supabase
        .from("patrimonio_itens")
        .update({ ...input, atualizado_em: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeletePatrimonioItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patrimonio_itens").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

/** Itens de um tipo, na ordem salva. */
export function itensDoTipo(itens: PatrimonioItem[], tipo: TipoItemPatrimonio): PatrimonioItem[] {
  return itens.filter((i) => i.tipo === tipo)
}

/**
 * Total por moeda (não converte entre EUR/BRL), na ordem em que as moedas aparecem.
 * Se `tipo` for passado, soma só os itens daquele tipo.
 */
export function totalPorMoeda(
  itens: PatrimonioItem[],
  tipo?: TipoItemPatrimonio,
): { moeda: Moeda; valor: number }[] {
  const totais = new Map<Moeda, number>()
  for (const item of itens) {
    if (tipo && item.tipo !== tipo) continue
    totais.set(item.moeda, (totais.get(item.moeda) ?? 0) + item.valor)
  }
  return Array.from(totais.entries()).map(([moeda, valor]) => ({ moeda, valor }))
}
