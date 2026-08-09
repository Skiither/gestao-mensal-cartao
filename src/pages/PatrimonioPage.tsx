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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  moedasNoHistorico, useAtualizarLancamentoPatrimonio, useAtualizarPatrimonio,
  useDeleteLancamentoPatrimonio, usePatrimonioHistorico, valorAtualPorTipo,
} from "@/hooks/usePatrimonio"
import { useAuth } from "@/contexts/AuthContext"
import { formatarMoeda } from "@/lib/format"
import type { Patrimonio, TipoPatrimonio } from "@/types/database"

const schema = z.object({
  tipo: z.enum(["guardado", "investido"]),
  valor: z.coerce.number().nonnegative("O valor não pode ser negativo"),
  moeda: z.enum(["EUR", "BRL"]),
})

type FormValues = z.output<typeof schema>
type FormInput = z.input<typeof schema>

export function PatrimonioPage() {
  const { moedaPadrao } = useAuth()
  const { data: historico, isLoading } = usePatrimonioHistorico()
  const atualizarMutation = useAtualizarPatrimonio()
  const editarMutation = useAtualizarLancamentoPatrimonio()
  const deleteMutation = useDeleteLancamentoPatrimonio()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Patrimonio | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "guardado", valor: 0, moeda: moedaPadrao },
  })

  function openCreate(tipo: TipoPatrimonio) {
    setEditing(null)
    form.reset({ tipo, valor: 0, moeda: moedaPadrao })
    setOpen(true)
  }

  function openEdit(lancamento: Patrimonio) {
    setEditing(lancamento)
    form.reset({ tipo: lancamento.tipo, valor: lancamento.valor, moeda: lancamento.moeda })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editing) {
        await editarMutation.mutateAsync({ id: editing.id, ...values })
        toast.success("Lançamento atualizado")
      } else {
        await atualizarMutation.mutateAsync(values)
        toast.success("Patrimônio atualizado")
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar patrimônio")
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success("Lançamento excluído")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir lançamento")
    }
  }

  const moedas = historico ? moedasNoHistorico(historico) : []
  const guardadoPorMoeda = moedas.map((m) => ({ moeda: m, valor: valorAtualPorTipo(historico ?? [], "guardado", m) }))
  const investidoPorMoeda = moedas.map((m) => ({ moeda: m, valor: valorAtualPorTipo(historico ?? [], "investido", m) }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Patrimônio</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openCreate("guardado")}>
              <Plus className="size-4" /> Atualizar valor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar lançamento" : "Atualizar patrimônio"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="guardado">Guardado</SelectItem>
                          <SelectItem value="investido">Investido</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Novo valor total</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} value={field.value as number} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="moeda"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moeda</FormLabel>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Guardado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {guardadoPorMoeda.length === 0 ? (
              <p className="text-xl font-semibold">{formatarMoeda(0)}</p>
            ) : (
              guardadoPorMoeda.map(({ moeda, valor }) => (
                <p key={moeda} className="text-xl font-semibold">{formatarMoeda(valor, moeda)}</p>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Investido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {investidoPorMoeda.length === 0 ? (
              <p className="text-xl font-semibold">{formatarMoeda(0)}</p>
            ) : (
              investidoPorMoeda.map(({ moeda, valor }) => (
                <p key={moeda} className="text-xl font-semibold">{formatarMoeda(valor, moeda)}</p>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {moedas.length === 0 ? (
              <p className="text-xl font-semibold">{formatarMoeda(0)}</p>
            ) : (
              moedas.map((moeda) => {
                const g = guardadoPorMoeda.find((x) => x.moeda === moeda)?.valor ?? 0
                const i = investidoPorMoeda.find((x) => x.moeda === moeda)?.valor ?? 0
                return <p key={moeda} className="text-xl font-semibold">{formatarMoeda(g + i, moeda)}</p>
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !historico || historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...historico].reverse().map((lancamento) => (
                  <TableRow key={lancamento.id}>
                    <TableCell>{new Date(lancamento.atualizado_em).toLocaleDateString("pt-PT")}</TableCell>
                    <TableCell>{lancamento.tipo === "guardado" ? "Guardado" : "Investido"}</TableCell>
                    <TableCell className="text-right">{formatarMoeda(lancamento.valor, lancamento.moeda)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(lancamento)} aria-label="Editar">
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(lancamento.id)} aria-label="Excluir">
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
