import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "next-themes"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useResetarDadosFinanceiros } from "@/hooks/useResetarConta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

const perfilSchema = z.object({
  nomeCompleto: z.string().min(1, "Informe seu nome completo"),
  email: z.string().email("E-mail inválido"),
})
type PerfilValues = z.infer<typeof perfilSchema>

const senhaSchema = z.object({
  password: z.string().min(6, "Mínimo de 6 caracteres"),
  confirmarPassword: z.string().min(6, "Mínimo de 6 caracteres"),
}).refine((v) => v.password === v.confirmarPassword, {
  message: "As senhas não coincidem", path: ["confirmarPassword"],
})
type SenhaValues = z.infer<typeof senhaSchema>

export function ConfiguracoesPage() {
  const { user, nomeCompleto, updatePerfil, updatePassword } = useAuth()

  const perfilForm = useForm<PerfilValues>({
    resolver: zodResolver(perfilSchema),
    defaultValues: { nomeCompleto, email: user?.email ?? "" },
  })
  const senhaForm = useForm<SenhaValues>({
    resolver: zodResolver(senhaSchema),
    defaultValues: { password: "", confirmarPassword: "" },
  })

  async function onSubmitPerfil(values: PerfilValues) {
    const emailMudou = values.email !== user?.email
    const { error } = await updatePerfil({ nomeCompleto: values.nomeCompleto, email: values.email })
    if (error) {
      toast.error(error)
      return
    }
    toast.success(emailMudou ? "Perfil atualizado — confirme o novo e-mail na caixa de entrada" : "Perfil atualizado")
  }

  async function onSubmitSenha(values: SenhaValues) {
    const { error } = await updatePassword(values.password)
    if (error) {
      toast.error(error)
      return
    }
    toast.success("Senha atualizada")
    senhaForm.reset({ password: "", confirmarPassword: "" })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
          <CardDescription>Seu nome e e-mail de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...perfilForm}>
            <form onSubmit={perfilForm.handleSubmit(onSubmitPerfil)} className="space-y-4">
              <FormField
                control={perfilForm.control}
                name="nomeCompleto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={perfilForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={perfilForm.formState.isSubmitting}>
                Salvar perfil
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Senha</CardTitle>
          <CardDescription>Defina uma nova senha de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...senhaForm}>
            <form onSubmit={senhaForm.handleSubmit(onSubmitSenha)} className="space-y-4">
              <FormField
                control={senhaForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={senhaForm.control}
                name="confirmarPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar nova senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={senhaForm.formState.isSubmitting}>
                Atualizar senha
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <AparenciaCard />
      <ZonaDeRisco />
    </div>
  )
}

function AparenciaCard() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Aparência</CardTitle>
        <CardDescription>Tema claro ou escuro</CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={resolvedTheme === "dark" ? "dark" : "light"} onValueChange={setTheme}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Claro</SelectItem>
            <SelectItem value="dark">Escuro</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}

function ZonaDeRisco() {
  const { user, signIn, reabrirOnboarding } = useAuth()
  const resetarMutation = useResetarDadosFinanceiros()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [etapa, setEtapa] = useState<"senha" | "confirmar">("senha")
  const [senha, setSenha] = useState("")
  const [verificando, setVerificando] = useState(false)

  function abrir() {
    setEtapa("senha")
    setSenha("")
    setOpen(true)
  }

  async function confirmarSenha() {
    if (!user?.email) return
    setVerificando(true)
    const { error } = await signIn(user.email, senha)
    setVerificando(false)
    if (error) {
      toast.error("Senha incorreta")
      return
    }
    setEtapa("confirmar")
  }

  async function executarReset() {
    try {
      await resetarMutation.mutateAsync()
      await reabrirOnboarding()
      setOpen(false)
      toast.success("Seus dados financeiros foram apagados")
      navigate("/onboarding", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao resetar os dados")
    }
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="size-4" /> Zona de risco
        </CardTitle>
        <CardDescription>
          Apaga todos os seus compromissos, cartões, categorias, receitas, metas e patrimônio.
          Sua conta de login continua existindo, mas os dados não podem ser recuperados depois disso.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={abrir}>
          Resetar dados financeiros
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            {etapa === "senha" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Confirme sua senha</DialogTitle>
                  <DialogDescription>
                    Por segurança, digite sua senha atual para continuar.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  type="password"
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={confirmarSenha} disabled={verificando || senha.length === 0}>
                    {verificando ? "Verificando..." : "Continuar"}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="text-destructive">Tem certeza?</DialogTitle>
                  <DialogDescription>
                    Isso vai apagar permanentemente todos os seus compromissos, cartões, categorias,
                    receitas, metas e patrimônio. Essa ação não pode ser desfeita.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button
                    variant="destructive"
                    onClick={executarReset}
                    disabled={resetarMutation.isPending}
                  >
                    {resetarMutation.isPending ? "Apagando..." : "Sim, apagar tudo"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
