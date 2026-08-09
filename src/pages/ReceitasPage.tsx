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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  useReceitas, useCreateReceita, useUpdateReceita, useDeleteReceita, useEditarReceitaRecorrente,
} from "@/hooks/useReceitas"
import { useCompetencia } from "@/contexts/CompetenciaContext"
import { useAuth } from "@/contexts/AuthContext"
import { formatarCompetencia } from "@/lib/competencia"
import { formatarData, formatarMoeda } from "@/lib/format"
import type { Receita } from "@/types/database"

const schema = z.object({
  nome: z.string().min(1, "Informe um nome"),
  valor: z.coerce.number().positive("O valor deve ser maior que zero"),
  data: z.string().min(1, "Informe a data"),
  tipo: z.enum(["recorrente", "extraordinaria"]),
})

type FormValues = z.output<typeof schema>
type FormInput = z.input<typeof schema>

export function ReceitasPage() {
  const { moedaPadrao } = useAuth()
  const { competencia } = useCompetencia()
  const { data: receitas, isLoading } = useReceitas(competencia)
  const createMutation = useCreateReceita()
  const updateMutation = useUpdateReceita()
  const editarRecorrenteMutation = useEditarReceitaRecorrente()
  const deleteMutation = useDeleteReceita()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Receita | null>(null)

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", valor: 0, data: `${competencia}-01`, tipo: "recorrente" },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ nome: "", valor: 0, data: `${competencia}-01`, tipo: "recorrente" })
    setOpen(true)
  }

  function openEdit(receita: Receita) {
    setEditing(receita)
    form.reset({ nome: receita.nome, valor: receita.valor, data: receita.data, tipo: receita.tipo })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    const input = { ...values, recorrente: values.tipo === "recorrente" }
    try {
      if (editing) {
        if (editing.tipo === "recorrente") {
          await editarRecorrenteMutation.mutateAsync({
            id: editing.id, ...input, competenciaEfetiva: competencia,
          })
          toast.success("Receita atualizada a partir deste mês — meses anteriores mantêm o valor antigo.")
        } else {
          await updateMutation.mutateAsync({ id: editing.id, ...input })
          toast.success("Receita atualizada")
        }
      } else {
        await createMutation.mutateAsync(input)
        toast.success("Receita criada")
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar receita")
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success("Receita excluída")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir receita")
    }
  }

  const total = receitas?.reduce((acc, r) => acc + r.valor, 0) ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Receitas — {formatarCompetencia(competencia)}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Nova receita
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar receita" : "Nova receita"}</DialogTitle>
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
                        <Input placeholder="Ex: Salário" {...field} />
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
                  name="data"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          <SelectItem value="recorrente">Recorrente</SelectItem>
                          <SelectItem value="extraordinaria">Extraordinária</SelectItem>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Total do mês: <span className="text-green-600">{formatarMoeda(total, moedaPadrao)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !receitas || receitas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma receita nesta competência.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receitas.map((receita) => (
                  <TableRow key={receita.id}>
                    <TableCell>{receita.nome}</TableCell>
                    <TableCell>
                      <Badge variant={receita.tipo === "recorrente" ? "default" : "secondary"}>
                        {receita.tipo === "recorrente" ? "Recorrente" : "Extraordinária"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatarData(receita.data)}</TableCell>
                    <TableCell className="text-right">{formatarMoeda(receita.valor, moedaPadrao)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(receita)} aria-label="Editar">
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(receita.id)} aria-label="Excluir">
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
