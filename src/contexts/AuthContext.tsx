import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { Moeda } from "@/types/database"

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  /** Moeda escolhida no onboarding; usada como padrão em todo o app exceto Patrimônio. */
  moedaPadrao: Moeda
  /** Nome completo preenchido no cadastro. */
  nomeCompleto: string
  /** Se a pessoa já preencheu a tela de primeiros dados (onboarding). */
  onboardingCompleto: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, nomeCompleto: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** Envia e-mail com link de redefinição de senha. */
  resetPassword: (email: string) => Promise<{ error: string | null }>
  /** Define uma nova senha (usado tanto na tela de redefinir quanto em Configurações). */
  updatePassword: (novaSenha: string) => Promise<{ error: string | null }>
  /** Atualiza nome e/ou e-mail do perfil. Trocar o e-mail dispara confirmação por e-mail no Supabase. */
  updatePerfil: (dados: { nomeCompleto?: string; email?: string }) => Promise<{ error: string | null }>
  /** Marca o onboarding como concluído e salva a moeda padrão escolhida. */
  completarOnboarding: (moedaPadrao: Moeda) => Promise<{ error: string | null }>
  /** Reabre o onboarding (usado depois de resetar os dados financeiros). */
  reabrirOnboarding: () => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string, nomeCompleto: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nome_completo: nomeCompleto } },
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    return { error: error?.message ?? null }
  }

  async function updatePassword(novaSenha: string) {
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    return { error: error?.message ?? null }
  }

  async function updatePerfil(dados: { nomeCompleto?: string; email?: string }) {
    const { error } = await supabase.auth.updateUser({
      email: dados.email,
      data: dados.nomeCompleto !== undefined ? { nome_completo: dados.nomeCompleto } : undefined,
    })
    return { error: error?.message ?? null }
  }

  async function completarOnboarding(moedaPadrao: Moeda) {
    const { error } = await supabase.auth.updateUser({
      data: { moeda_padrao: moedaPadrao, onboarding_completo: true },
    })
    return { error: error?.message ?? null }
  }

  async function reabrirOnboarding() {
    const { error } = await supabase.auth.updateUser({ data: { onboarding_completo: false } })
    return { error: error?.message ?? null }
  }

  const moedaPadrao = (session?.user.user_metadata?.moeda_padrao as Moeda | undefined) ?? "EUR"
  const nomeCompleto = (session?.user.user_metadata?.nome_completo as string | undefined) ?? ""
  const onboardingCompleto = session?.user.user_metadata?.onboarding_completo === true

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        moedaPadrao,
        nomeCompleto,
        onboardingCompleto,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        updatePerfil,
        completarOnboarding,
        reabrirOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>")
  return ctx
}
