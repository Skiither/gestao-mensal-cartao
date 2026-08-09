import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useCreateMeta, useDeleteMeta, useMetas, useUpdateMeta } from "@/hooks/useMetas"
import { useAuth } from "@/contexts/AuthContext"
import { formatarMoeda } from "@/lib/format"
import type { Meta } from "@/types/database"

const schema = z.object({
  nome: z.string().min(1, "Informe um nome"),
  valor_desejado: z.coerce.number().positive("O valor deve ser maior que zero"),
  valor_acumulado: z.coerce.number().nonnegative(),
})

type FormValues = z.output<typeof schema>
type FormInput = z.input<typeof schema>

export function MetasPage() {
  const { moedaPadrao } = useAuth()
  const { data: metas, isLoading } = useMetas()
  const createMutation = useCreateMeta()
  const updateMutation = useUpdateMeta()
  const deleteMutation = useDeleteMeta()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Meta | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", valor_desejado: 0, valor_acumulado: 0 },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ nome: "", valor_desejado: 0, valor_acumulado: 0 })
    setOpen(true)
  }

  function openEdit(meta: Meta) {
    setEditing(meta)
    form.reset({ nome: meta.nome, valor_desejado: meta.valor_desejado, valor_acumulado: meta.valor_acumulado })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...values, moeda: editing.moeda })
        toast.success("Meta atualizada")
      } else {
        await createMutation.mutateAsync({ ...values, moeda: moedaPadrao })
        toast.success("Meta criada")
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar meta")
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success("Meta excluída")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir meta")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Metas</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Nova meta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar meta" : "Nova meta"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Reserva de emergência" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valor_desejado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor desejado</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} value={field.value as number} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valor_acumulado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor já acumulado</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} value={field.value as number} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    Salvar
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !metas || metas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {metas.map((meta) => {
            const percentual = meta.valor_desejado > 0
              ? Math.min(100, (meta.valor_acumulado / meta.valor_desejado) * 100)
              : 0
            const restante = Math.max(0, meta.valor_desejado - meta.valor_acumulado)

            return (
              <Card key={meta.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <CardTitle className="text-base">{meta.nome}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(meta)} aria-label="Editar">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => onDelete(meta.id)} aria-label="Excluir">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Progress value={percentual} />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{formatarMoeda(meta.valor_acumulado, meta.moeda)} de {formatarMoeda(meta.valor_desejado, meta.moeda)}</span>
                    <span>{percentual.toFixed(0)}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Faltam {formatarMoeda(restante, meta.moeda)}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
