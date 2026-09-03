import { Link } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

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
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="Voltar ao perfil">
          <Link to="/perfil">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="font-heading text-[clamp(1.9rem,4vw,2.6rem)] font-normal leading-[1.05] tracking-tight">Configurações</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alterar dados</CardTitle>
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
                Salvar dados
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
    </div>
  )
}
