import { useState, type MouseEvent } from "react"
import { Link } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCartoes, useCreateCartao, useUpdateCartao, useDeleteCartao } from "@/hooks/useCartoes"
import { useQuantidadeComprasAtivasPorCartao, useTotalPendentePorCartao } from "@/hooks/useComprasParceladas"
import { useAuth } from "@/contexts/AuthContext"
import { formatarMoeda } from "@/lib/format"
import type { Cartao } from "@/types/database"

const schema = z.object({
  nome: z.string().min(1, "Informe um nome"),
  limite: z.coerce.number().nonnegative().optional(),
  dia_fechamento: z.coerce.number().int().min(1).max(31),
  dia_vencimento: z.coerce.number().int().min(1).max(31),
})

type FormValues = z.output<typeof schema>
type FormInput = z.input<typeof schema>

export function CartoesPage() {
  const { moedaPadrao } = useAuth()
  const { data: cartoes, isLoading } = useCartoes()
  const { data: totalPendentePorCartao } = useTotalPendentePorCartao()
  const { data: quantidadeComprasPorCartao } = useQuantidadeComprasAtivasPorCartao()
  const createMutation = useCreateCartao()
  const updateMutation = useUpdateCartao()
  const deleteMutation = useDeleteCartao()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Cartao | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", limite: undefined, dia_fechamento: 1, dia_vencimento: 10 },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ nome: "", limite: undefined, dia_fechamento: 1, dia_vencimento: 10 })
    setOpen(true)
  }

  function openEdit(cartao: Cartao, e: MouseEvent) {
    e.preventDefault()
    setEditing(cartao)
    form.reset({
      nome: cartao.nome,
      limite: cartao.limite ?? undefined,
      dia_fechamento: cartao.dia_fechamento,
      dia_vencimento: cartao.dia_vencimento,
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const input = { ...values, limite: values.limite ?? null }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...input })
        toast.success("Cartão atualizado")
      } else {
        await createMutation.mutateAsync(input)
        toast.success("Cartão criado")
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar cartão")
    }
  }

  async function onDelete(id: string, e: MouseEvent) {
    e.preventDefault()
    try {
      await deleteMutation.mutateAsync(id)
      toast.success("Cartão excluído")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir cartão")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cartões</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Novo cartão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar cartão" : "Novo cartão"}</DialogTitle>
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
                        <Input placeholder="Ex: Nubank" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="limite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite (opcional)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} value={(field.value as number | undefined) ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dia_fechamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dia fechamento</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="31" {...field} value={field.value as number} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dia_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dia vencimento</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="31" {...field} value={field.value as number} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
      ) : !cartoes || cartoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cartoes.map((cartao) => (
            <Link key={cartao.id} to={`/cartoes/${cartao.id}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="size-5 text-muted-foreground" />
                    <CardTitle className="text-base">{cartao.nome}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={(e) => openEdit(cartao, e)} aria-label="Editar">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={(e) => onDelete(cartao.id, e)} aria-label="Excluir">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  {cartao.limite != null && (
                    <>
                      <p>Limite: {formatarMoeda(cartao.limite, moedaPadrao)}</p>
                      <p>
                        Disponível:{" "}
                        {formatarMoeda(
                          cartao.limite - (totalPendentePorCartao?.get(cartao.id) ?? 0),
                          moedaPadrao
                        )}
                      </p>
                    </>
                  )}
                  <p>Fecha dia {cartao.dia_fechamento}, vence dia {cartao.dia_vencimento}</p>
                  {(() => {
                    const qtd = quantidadeComprasPorCartao?.get(cartao.id) ?? 0
                    return <p>{qtd} {qtd === 1 ? "compra ativa" : "compras ativas"}</p>
                  })()}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
