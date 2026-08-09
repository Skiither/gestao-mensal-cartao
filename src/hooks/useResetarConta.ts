import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

/**
 * Apaga todos os dados financeiros do usuário (compromissos, cartões, compras parceladas,
 * parcelas, categorias, receitas, metas, patrimônio), mas preserva a conta de login.
 * `compras_parceladas` e `parcelas` não têm coluna `user_id` própria — a posse é garantida
 * pela política RLS (via join com `cartoes`), então o filtro abaixo só existe para
 * satisfazer a exigência do PostgREST de ao menos um filtro num delete.
 */
export function useResetarDadosFinanceiros() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado")

      const { error: parcelasError } = await supabase.from("parcelas").delete().not("id", "is", null)
      if (parcelasError) throw parcelasError

      const { error: comprasError } = await supabase.from("compras_parceladas").delete().not("id", "is", null)
      if (comprasError) throw comprasError

      const { error: cartoesError } = await supabase.from("cartoes").delete().eq("user_id", user.id)
      if (cartoesError) throw cartoesError

      const { error: compromissosError } = await supabase
        .from("compromissos_financeiros").delete().eq("user_id", user.id)
      if (compromissosError) throw compromissosError

      const { error: categoriasError } = await supabase.from("categorias").delete().eq("user_id", user.id)
      if (categoriasError) throw categoriasError

      const { error: receitasError } = await supabase.from("receitas").delete().eq("user_id", user.id)
      if (receitasError) throw receitasError

      const { error: metasError } = await supabase.from("metas").delete().eq("user_id", user.id)
      if (metasError) throw metasError

      const { error: patrimonioError } = await supabase.from("patrimonio").delete().eq("user_id", user.id)
      if (patrimonioError) throw patrimonioError
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
