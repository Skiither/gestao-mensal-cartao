import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { Meta, Moeda } from "@/types/database"

const KEY = ["metas"]

export interface MetaInput {
  nome: string
  valor_desejado: number
  valor_acumulado: number
  moeda: Moeda
}

export function useMetas() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("metas").select("*").order("nome")
      if (error) throw error
      return data as Meta[]
    },
  })
}

export function useCreateMeta() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: MetaInput) => {
      if (!user) throw new Error("Usuário não autenticado")
      const { error } = await supabase.from("metas").insert({ ...input, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateMeta() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: MetaInput & { id: string }) => {
      const { error } = await supabase.from("metas").update(input).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteMeta() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
