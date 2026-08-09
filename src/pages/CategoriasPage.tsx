import { useMemo, useState, type MouseEvent } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, Layers, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { CompromissoCategoriaPainel } from "@/components/CompromissoCategoriaPainel"
import {
  useCategorias, useCreateCategoria, useUpdateCategoria, useDeleteCategoria,
} from "@/hooks/useCategorias"
import { useTodosCompromissos } from "@/hooks/useCompromissos"
import { formatarMoeda } from "@/lib/format"
import { useAuth } from "@/contexts/AuthContext"
import { corDaCategoria } from "@/lib/categoriaColor"
import type { Categoria } from "@/types/database"

const schema = z.object({ nome: z.string().min(1, "Informe um nome") })
type FormValues = z.infer<typeof schema>

function hojeISO() {
  return new Date().toISOString().slice(0, 10)
}

export function CategoriasPage() {
  const { moedaPadrao } = useAuth()
  const { data: categorias, isLoading } = useCategorias()
  const { data: compromissos, isLoading: isLoadingCompromissos } = useTodosCompromissos()
  const createMutation = useCreateCategoria()
  const updateMutation = useUpdateCategoria()
  const deleteMutation = useDeleteCategoria()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Categoria | null>(null)
  const [abertos, setAbertos] = useState<Set<string>>(new Set())

  function toggleAberto(id: string) {
    setAbertos((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { nome: "" } })

  function openCreate() {
    setEditing(null)
    form.reset({ nome: "" })
    setOpen(true)
  }

  function openEdit(categoria: Categoria, e: MouseEvent) {
    e.stopPropagation()
    setEditing(categoria)
    form.reset({ nome: categoria.nome })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, nome: values.nome })
        toast.success("Categoria atualizada")
      } else {
        await createMutation.mutateAsync(values.nome)
        toast.success("Categoria criada")
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar categoria")
    }
  }

  async function onDelete(id: string, e: MouseEvent) {
    e.stopPropagation()
    try {
      await deleteMutation.mutateAsync(id)
      toast.success("Categoria excluída")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir categoria")
    }
  }

  const porCategoria = useMemo(() => {
    // `compromissos` já vem ordenado por competência decrescente. Para recorrentes, cada mês
    // gera uma linha própria — aqui só interessa a mais recente de cada série (a gestão fica
    // em Compromissos, mês a mês); eventuais aparecem todos, cada um é um lançamento distinto.
    const seriesVistas = new Set<string>()
    const grupos = new Map<string, NonNullable<typeof compromissos>>()
    for (const c of compromissos ?? []) {
      if (!c.categoria_id) continue
      if (c.recorrencia === "recorrente") {
        // serie_id pode ainda não existir no banco (migração pendente) — nesse caso cai pro
        // próprio id, tratando cada linha como série única em vez de colapsar tudo junto.
        const chaveSerie = c.serie_id ?? c.id
        if (seriesVistas.has(chaveSerie)) continue
        seriesVistas.add(chaveSerie)
      }
      const lista = grupos.get(c.categoria_id) ?? []
      lista.push(c)
      grupos.set(c.categoria_id, lista)
    }
    return grupos
  }, [compromissos])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categorias</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Nova categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle>
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
                        <Input placeholder="Ex: Moradia" {...field} />
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
      ) : !categorias || categorias.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada ainda.</p>
      ) : (() => {
        const colunaEsquerda = categorias.filter((_, i) => i % 2 === 0)
        const colunaDireita = categorias.filter((_, i) => i % 2 === 1)

        const renderTile = (categoria: Categoria) => {
          const itens = porCategoria.get(categoria.id) ?? []
          const isOpen = abertos.has(categoria.id)
          const ativos = itens.filter((c) => c.recorrencia === "recorrente").length
          const cor = corDaCategoria(categoria.id, categorias)
          return (
            <Collapsible key={categoria.id} open={isOpen} onOpenChange={() => toggleAberto(categoria.id)} asChild>
              <Card className="h-fit border-l-4 transition-colors" style={{ borderLeftColor: cor }}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer flex flex-row items-start justify-between hover:bg-accent/40">
                    <div className="flex items-center gap-2">
                      <Layers className="size-5" style={{ color: cor }} />
                      <CardTitle className="text-base">{categoria.nome}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={(e) => openEdit(categoria, e)} aria-label="Editar">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={(e) => onDelete(categoria.id, e)} aria-label="Excluir">
                        <Trash2 className="size-3.5" />
                      </Button>
                      {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    {itens.length === 0
                      ? "Nenhum compromisso cadastrado"
                      : `${itens.length} compromisso(s) · ${ativos} recorrente(s)`}
                  </p>
                  {itens.length > 0 && (
                    <p className="text-foreground font-medium">
                      {formatarMoeda(itens.reduce((acc, c) => acc + c.valor, 0), moedaPadrao)} no total
                    </p>
                  )}
                </CardContent>
                <CollapsibleContent>
                  <CardContent className="pt-2">
                    <CompromissoCategoriaPainel
                      categoriaId={categoria.id}
                      itens={itens}
                      isLoading={isLoadingCompromissos}
                      vencimentoPadrao={hojeISO()}
                      mostrarPago={false}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )
        }

        return (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex flex-1 flex-col gap-3">{colunaEsquerda.map(renderTile)}</div>
            <div className="flex flex-1 flex-col gap-3">{colunaDireita.map(renderTile)}</div>
          </div>
        )
      })()}
    </div>
  )
}
