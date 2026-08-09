import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { Cartao } from "@/types/database"

const KEY = ["cartoes"]

export interface CartaoInput {
  nome: string
  limite: number | null
  dia_fechamento: number
  dia_vencimento: number
}

export function useCartoes() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("cartoes").select("*").order("nome")
      if (error) throw error
      return data as Cartao[]
    },
  })
}

export function useCartao(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("cartoes").select("*").eq("id", id!).single()
      if (error) throw error
      return data as Cartao
    },
  })
}

export function useCreateCartao() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: CartaoInput) => {
      if (!user) throw new Error("Usuário não autenticado")
      const { error } = await supabase.from("cartoes").insert({ ...input, user_id: user.id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateCartao() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: CartaoInput & { id: string }) => {
      const { error } = await supabase.from("cartoes").update(input).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteCartao() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cartoes").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
