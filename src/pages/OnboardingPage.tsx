import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useCreateReceita } from "@/hooks/useReceitas"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const schema = z.object({
  moeda: z.enum(["EUR", "BRL"]),
  receitas: z.array(z.object({
    nome: z.string(),
    valor: z.coerce.number().nonnegative("O valor não pode ser negativo"),
  })),
})

type FormValues = z.output<typeof schema>
type FormInput = z.input<typeof schema>

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export function OnboardingPage() {
  const { completarOnboarding, onboardingCompleto } = useAuth()
  const createReceita = useCreateReceita()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  if (onboardingCompleto) {
    return <Navigate to="/" replace />
  }

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      moeda: "EUR",
      receitas: [{ nome: "Salário", valor: 0 }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "receitas" })

  async function finalizar(moeda: FormValues["moeda"], receitas: FormValues["receitas"]) {
    setLoading(true)
    try {
      const validas = receitas.filter((r) => r.nome.trim().length > 0 && r.valor > 0)
      for (const receita of validas) {
        await createReceita.mutateAsync({
          nome: receita.nome.trim(),
          valor: receita.valor,
          data: hojeISO(),
          recorrente: true,
          tipo: "recorrente",
        })
      }
      const { error } = await completarOnboarding(moeda)
      if (error) {
        toast.error(error)
        setLoading(false)
        return
      }
      navigate("/", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar seus dados")
      setLoading(false)
    }
  }

  async function onSubmit(values: FormValues) {
    await finalizar(values.moeda, values.receitas)
  }

  async function pular() {
    await finalizar(form.getValues("moeda"), [])
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Vamos começar</CardTitle>
          <CardDescription>
            Conte um pouco sobre suas finanças pra gente montar seu painel. Dá pra ajustar tudo depois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="moeda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moeda padrão</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="EUR">Euro (€)</SelectItem>
                        <SelectItem value="BRL">Real (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <div>
                  <FormLabel>Receitas mensais fixas</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Salário, benefícios ou qualquer entrada que se repete todo mês. Pode deixar em branco e preencher depois.
                  </p>
                </div>
                {fields.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <FormField
                      control={form.control}
                      name={`receitas.${index}.nome`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Ex: Salário" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`receitas.${index}.valor`}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormControl>
                            <Input type="number" step="0.01" min="0" placeholder="Valor" {...field} value={field.value as number} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      aria-label="Remover"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ nome: "", valor: 0 })}
                >
                  <Plus className="size-4" /> Adicionar outra receita
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Salvando..." : "Concluir"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" disabled={loading} onClick={pular}>
                  Pular por agora
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
