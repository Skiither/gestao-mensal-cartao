import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
})

const signupSchema = z.object({
  nomeCompleto: z.string().min(1, "Informe seu nome completo"),
  email: z.string().email("E-mail inválido"),
  confirmarEmail: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
  confirmarPassword: z.string().min(6, "Mínimo de 6 caracteres"),
}).refine((v) => v.email === v.confirmarEmail, {
  message: "Os e-mails não coincidem", path: ["confirmarEmail"],
}).refine((v) => v.password === v.confirmarPassword, {
  message: "As senhas não coincidem", path: ["confirmarPassword"],
})

const recuperarSchema = z.object({
  email: z.string().email("E-mail inválido"),
})

type LoginValues = z.infer<typeof loginSchema>
type SignupValues = z.infer<typeof signupSchema>
type RecuperarValues = z.infer<typeof recuperarSchema>

export function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [modo, setModo] = useState<"credenciais" | "recuperar">("credenciais")

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })
  const signupForm = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { nomeCompleto: "", email: "", confirmarEmail: "", password: "", confirmarPassword: "" },
  })
  const recuperarForm = useForm<RecuperarValues>({
    resolver: zodResolver(recuperarSchema),
    defaultValues: { email: "" },
  })

  async function handleLogin(values: LoginValues) {
    setLoading(true)
    const { error } = await signIn(values.email, values.password)
    setLoading(false)
    if (error) {
      toast.error(error)
      return
    }
    navigate("/", { replace: true })
  }

  async function handleSignup(values: SignupValues) {
    setLoading(true)
    const { error } = await signUp(values.email, values.password, values.nomeCompleto)
    setLoading(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success("Conta criada! Verifique seu e-mail se a confirmação estiver ativada.")
    navigate("/", { replace: true })
  }

  async function handleRecuperar(values: RecuperarValues) {
    setLoading(true)
    const { error } = await resetPassword(values.email)
    setLoading(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success("Enviamos um link de recuperação para o seu e-mail.")
    setModo("credenciais")
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Planejamento Financeiro</CardTitle>
          <CardDescription>
            {modo === "recuperar" ? "Recupere o acesso à sua conta" : "Entre ou crie sua conta para continuar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {modo === "recuperar" ? (
            <Form {...recuperarForm}>
              <form onSubmit={recuperarForm.handleSubmit(handleRecuperar)} className="space-y-4">
                <FormField
                  control={recuperarForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="voce@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setModo("credenciais")}>
                  Voltar para o login
                </Button>
              </form>
            </Form>
          ) : (
            <Tabs defaultValue="login">
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">Entrar</TabsTrigger>
                <TabsTrigger value="cadastro" className="flex-1">Cadastrar</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4 pt-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="voce@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Senha</FormLabel>
                            <button
                              type="button"
                              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                              onClick={() => setModo("recuperar")}
                            >
                              Esqueci minha senha
                            </button>
                          </div>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Entrando..." : "Entrar"}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="cadastro">
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4 pt-4">
                    <FormField
                      control={signupForm.control}
                      name="nomeCompleto"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome completo</FormLabel>
                          <FormControl>
                            <Input placeholder="Seu nome completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="voce@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="confirmarEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar e-mail</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="voce@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="confirmarPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar senha</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Criando conta..." : "Criar conta"}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
