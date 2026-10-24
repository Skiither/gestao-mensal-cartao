import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { gerarCodigo, VALIDADE_CODIGO_MINUTOS } from "@/lib/codigoWhatsapp"

const KEY = ["whatsapp_vinculo"]

/** Número de WhatsApp ligado à conta, ou null. `observar` faz consultar de tempos em tempos
 *  (enquanto um código está na tela, para perceber quando o bot fizer a ligação). */
export function useVinculoWhatsapp(observar = false) {
  const { user } = useAuth()

  return useQuery({
    queryKey: KEY,
    enabled: !!user,
    refetchInterval: observar ? 4000 : false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_vinculos")
        .select("telefone, criado_em")
        .eq("user_id", user!.id)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Gera (ou substitui) o código temporário da conta. */
export function useGerarCodigoWhatsapp() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado")
      const expira_em = new Date(Date.now() + VALIDADE_CODIGO_MINUTOS * 60 * 1000).toISOString()
      // O código é único entre todas as contas: numa colisão (raríssima), sorteia outro.
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const codigo = gerarCodigo()
        const { error } = await supabase
          .from("whatsapp_codigos")
          .upsert({ user_id: user.id, codigo, expira_em }, { onConflict: "user_id" })
        if (!error) return { codigo, expira_em }
        if (error.code !== "23505") throw error
      }
      throw new Error("Não foi possível gerar o código, tente de novo")
    },
  })
}

export function useDesconectarWhatsapp() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado")
      const { error } = await supabase.from("whatsapp_vinculos").delete().eq("user_id", user.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
