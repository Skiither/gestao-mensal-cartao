import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  useCreateCompromisso, useUpdateCompromisso, useDeleteCompromisso, useMarcarCompromissoPago,
} from "@/hooks/useCompromissos"
import { useCategorias } from "@/hooks/useCategorias"
import { useAuth } from "@/contexts/AuthContext"
import { formatarData, formatarMoeda } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CompromissoFinanceiro } from "@/types/database"

const SEM_CATEGORIA_SELECT = "__sem_categoria__"

const schema = z.object({
  nome: z.string().min(1, "Informe um nome"),
  valor: z.coerce.number().positive("O valor deve ser maior que zero"),
  vencimento: z.string().min(1, "Informe a data de vencimento"),
  recorrencia: z.enum(["recorrente", "eventual"]),
  categoria_id: z.string().nullable(),
})

type FormValues = z.output<typeof schema>
type FormInput = z.input<typeof schema>

interface CompromissoCategoriaPainelProps {
  categoriaId: string | null
  itens: CompromissoFinanceiro[]
  isLoading: boolean
  vencimentoPadrao: string
  /** Mostra a coluna e o checkbox de pago/pendente (não faz sentido na gestão por Categorias). */
  mostrarPago?: boolean
}

export function CompromissoCategoriaPainel({
  categoriaId, itens, isLoading, vencimentoPadrao, mostrarPago = true,
}: CompromissoCategoriaPainelProps) {
  const { moedaPadrao } = useAuth()
  const { data: categorias } = useCategorias()
  const createMutation = useCreateCompromisso()
  const updateMutation = useUpdateCompromisso()
  const deleteMutation = useDeleteCompromisso()
  const marcarPagoMutation = useMarcarCompromissoPago()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CompromissoFinanceiro | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", valor: 0, vencimento: vencimentoPadrao, recorrencia: "eventual", categoria_id: categoriaId },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ nome: "", valor: 0, vencimento: vencimentoPadrao, recorrencia: "eventual", categoria_id: categoriaId })
    setOpen(true)
  }

  function openEdit(compromisso: CompromissoFinanceiro) {
    setEditing(compromisso)
    form.reset({
      nome: compromisso.nome,
      valor: compromisso.valor,
      vencimento: compromisso.vencimento,
      recorrencia: compromisso.recorrencia,
      categoria_id: compromisso.categoria_id,
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const input = values
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...input })
        toast.success("Compromisso atualizado")
      } else {
        await createMutation.mutateAsync(input)
        toast.success("Compromisso criado")
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar compromisso")
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success("Compromisso excluído")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir compromisso")
    }
  }

  async function onToggleStatus(compromisso: CompromissoFinanceiro, pago: boolean) {
    try {
      await marcarPagoMutation.mutateAsync({ compromisso, pago })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="size-4" /> Novo compromisso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
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
                        <Input placeholder="Ex: Aluguel" {...field} />
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
                      <FormLabel>Valor</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} value={field.value as number} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vencimento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vencimento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recorrencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recorrência</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="recorrente">Recorrente</SelectItem>
                          <SelectItem value="eventual">Eventual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {editing && (
                  <FormField
                    control={form.control}
                    name="categoria_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <Select
                          value={field.value ?? SEM_CATEGORIA_SELECT}
                          onValueChange={(v) => field.onChange(v === SEM_CATEGORIA_SELECT ? null : v)}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={SEM_CATEGORIA_SELECT}>Sem categoria</SelectItem>
                            {categorias?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
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
      ) : itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum compromisso aqui ainda.</p>
      ) : (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {mostrarPago && <TableHead className="w-10">Pago</TableHead>}
              <TableHead>Nome</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Recorrência</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((compromisso) => (
              <TableRow key={compromisso.id} className={cn(compromisso.status === "pago" && "opacity-60")}>
                {mostrarPago && (
                  <TableCell>
                    <Checkbox
                      checked={compromisso.status === "pago"}
                      onCheckedChange={(checked) => onToggleStatus(compromisso, checked === true)}
                      aria-label="Marcar compromisso como pago"
                    />
                  </TableCell>
                )}
                <TableCell className={cn(compromisso.status === "pago" && "line-through")}>
                  {compromisso.nome}
                </TableCell>
                <TableCell>{formatarData(compromisso.vencimento)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {compromisso.recorrencia === "recorrente" ? "Recorrente" : "Eventual"}
                </TableCell>
                <TableCell className="text-right">{formatarMoeda(compromisso.valor, moedaPadrao)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(compromisso)} aria-label="Editar">
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(compromisso.id)} aria-label="Excluir">
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
    </div>
  )
}
