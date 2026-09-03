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
import { ConfirmDialog } from "@/components/ConfirmDialog"
import {
  itensDoTipo, totalPorMoeda, usePatrimonioItens,
  useCreatePatrimonioItem, useUpdatePatrimonioItem, useDeletePatrimonioItem, type ItemInput,
} from "@/hooks/usePatrimonioItens"
import { useAuth } from "@/contexts/AuthContext"
import { formatarMoeda } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Moeda, PatrimonioItem, TipoItemPatrimonio } from "@/types/database"

const itemSchema = z.object({
  nome: z.string().min(1, "Informe um nome"),
  valor: z.coerce.number().nonnegative("O valor não pode ser negativo"),
  moeda: z.enum(["EUR", "BRL"]),
})
type ItemFormInput = z.input<typeof itemSchema>

function somaMoedas(...listas: { moeda: Moeda; valor: number }[][]) {
  const totais = new Map<Moeda, number>()
  for (const lista of listas) {
    for (const { moeda, valor } of lista) totais.set(moeda, (totais.get(moeda) ?? 0) + valor)
  }
  return Array.from(totais.entries()).map(([moeda, valor]) => ({ moeda, valor }))
}

function textoMoedas(valores: { moeda: Moeda; valor: number }[]) {
  if (valores.length === 0) return formatarMoeda(0)
  return valores.map((v) => formatarMoeda(v.valor, v.moeda)).join("  ·  ")
}

export function PatrimonioPage() {
  const { moedaPadrao } = useAuth()
  const { data: itens, isLoading } = usePatrimonioItens()
  const todos = itens ?? []

  const contas = itensDoTipo(todos, "conta")
  const guardado = itensDoTipo(todos, "guardado")
  const investido = itensDoTipo(todos, "investido")

  const saldoGeral = totalPorMoeda(contas)
  const totalGuardado = totalPorMoeda(guardado)
  const totalInvestido = totalPorMoeda(investido)
  const patrimonioTotal = somaMoedas(saldoGeral, totalGuardado, totalInvestido)

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-[clamp(1.9rem,4vw,2.6rem)] font-normal leading-[1.05] tracking-tight">Património</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">Saldo geral (suas contas)</CardTitle>
          </CardHeader>
          <CardContent>
            {saldoGeral.length === 0 ? (
              <p className="font-mono text-2xl font-medium tracking-tight">{formatarMoeda(0)}</p>
            ) : (
              saldoGeral.map((v, i) => (
                <p key={v.moeda} className={cn("font-mono tabular-nums tracking-tight", i === 0 ? "text-2xl font-medium" : "text-sm text-muted-foreground")}>{formatarMoeda(v.valor, v.moeda)}</p>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">Patrimônio total</CardTitle>
          </CardHeader>
          <CardContent>
            {patrimonioTotal.length === 0 ? (
              <p className="font-mono text-2xl font-medium tracking-tight">{formatarMoeda(0)}</p>
            ) : (
              patrimonioTotal.map((v, i) => (
                <p key={v.moeda} className={cn("font-mono tabular-nums tracking-tight", i === 0 ? "text-2xl font-medium" : "text-sm text-muted-foreground")}>{formatarMoeda(v.valor, v.moeda)}</p>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <SecaoItens
        tipo="conta"
        titulo="Minhas contas"
        vazio="Nenhuma conta ainda. Adicione onde seu dinheiro fica no dia a dia (banco, carteira, dinheiro em espécie...)."
        itens={contas}
        subtotal={saldoGeral}
        isLoading={isLoading}
        moedaPadrao={moedaPadrao}
      />
      <SecaoItens
        tipo="guardado"
        titulo="Guardado"
        vazio="Nada guardado ainda. Adicione uma reserva, poupança, cofrinho... com o nome que quiser."
        itens={guardado}
        subtotal={totalGuardado}
        isLoading={isLoading}
        moedaPadrao={moedaPadrao}
      />
      <SecaoItens
        tipo="investido"
        titulo="Investido"
        vazio="Nada investido ainda. Adicione onde seu dinheiro está aplicado (XP, Rico, Nubank, tesouro...)."
        itens={investido}
        subtotal={totalInvestido}
        isLoading={isLoading}
        moedaPadrao={moedaPadrao}
      />
    </div>
  )
}

function SecaoItens({
  tipo, titulo, vazio, itens, subtotal, isLoading, moedaPadrao,
}: {
  tipo: TipoItemPatrimonio
  titulo: string
  vazio: string
  itens: PatrimonioItem[]
  subtotal: { moeda: Moeda; valor: number }[]
  isLoading: boolean
  moedaPadrao: Moeda
}) {
  const createMutation = useCreatePatrimonioItem()
  const updateMutation = useUpdatePatrimonioItem()
  const deleteMutation = useDeletePatrimonioItem()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PatrimonioItem | null>(null)

  const form = useForm<ItemFormInput, unknown, z.output<typeof itemSchema>>({
    resolver: zodResolver(itemSchema),
    defaultValues: { nome: "", valor: 0, moeda: moedaPadrao },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ nome: "", valor: 0, moeda: moedaPadrao })
    setOpen(true)
  }

  function openEdit(item: PatrimonioItem) {
    setEditing(item)
    form.reset({ nome: item.nome, valor: item.valor, moeda: item.moeda })
    setOpen(true)
  }

  async function onSubmit(values: z.output<typeof itemSchema>) {
    const input: ItemInput = { tipo, ...values }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...input })
        toast.success("Item atualizado")
      } else {
        await createMutation.mutateAsync(input)
        toast.success("Item adicionado")
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar")
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success("Item excluído")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <div className="flex items-center gap-3">
          {subtotal.length > 0 && (
            <span className="hidden font-mono text-sm text-muted-foreground tabular-nums sm:inline">{textoMoedas(subtotal)}</span>
          )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="size-4" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar" : "Adicionar"} em {titulo.toLowerCase()}
              </DialogTitle>
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
                        <Input
                          placeholder={
                            tipo === "investido" ? "Ex: XP, Rico, tesouro..."
                            : tipo === "guardado" ? "Ex: Reserva, poupança..."
                            : "Ex: Nubank, Revolut, dinheiro..."
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quanto tem</FormLabel>
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
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vazio}</p>
        ) : (
          <ul className="divide-y">
            {itens.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex-1 truncate">{item.nome}</span>
                <span className="font-mono tabular-nums">{formatarMoeda(item.valor, item.moeda)}</span>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(item)} aria-label="Editar">
                  <Pencil className="size-3.5" />
                </Button>
                <ConfirmDialog
                  title="Excluir item?"
                  description={`Isso vai excluir "${item.nome}" permanentemente.`}
                  onConfirm={() => onDelete(item.id)}
                  trigger={
                    <Button variant="ghost" size="icon" className="size-7" aria-label="Excluir">
                      <Trash2 className="size-3.5" />
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
