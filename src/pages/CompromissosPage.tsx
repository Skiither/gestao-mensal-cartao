import { useMemo, useState, type ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { ChevronDown, ChevronUp, CreditCard, Layers, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { CompromissoCategoriaPainel } from "@/components/CompromissoCategoriaPainel"
import { useCompromissos, useCreateCompromisso } from "@/hooks/useCompromissos"
import { useMarcarParcelaPaga, useParcelasDaCompetencia } from "@/hooks/useComprasParceladas"
import { useCategorias } from "@/hooks/useCategorias"
import { useCompetencia } from "@/contexts/CompetenciaContext"
import { useAuth } from "@/contexts/AuthContext"
import { formatarCompetencia } from "@/lib/competencia"
import { formatarMoeda } from "@/lib/format"
import { cn } from "@/lib/utils"
import { SEM_CATEGORIA_ID } from "@/lib/constants"
import { corDaCategoria } from "@/lib/categoriaColor"

const schema = z.object({
  nome: z.string().min(1, "Informe um nome"),
  valor: z.coerce.number().positive("O valor deve ser maior que zero"),
  vencimento: z.string().min(1, "Informe a data de vencimento"),
  categoria_id: z.string().nullable(),
  recorrencia: z.enum(["recorrente", "eventual"]),
})

type FormValues = z.output<typeof schema>
type FormInput = z.input<typeof schema>

const SEM_CATEGORIA_SELECT = "__sem_categoria__"

export function CompromissosPage() {
  const { moedaPadrao } = useAuth()
  const { competencia } = useCompetencia()
  const { data: compromissos, isLoading } = useCompromissos(competencia)
  const { data: categorias } = useCategorias()
  const { data: parcelas } = useParcelasDaCompetencia(competencia)
  const createMutation = useCreateCompromisso()
  const marcarParcelaPagaMutation = useMarcarParcelaPaga()

  const [open, setOpen] = useState(false)
  const [abertos, setAbertos] = useState<Set<string>>(new Set())

  function toggleAberto(id: string) {
    setAbertos((prev) => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "", valor: 0, vencimento: `${competencia}-05`,
      categoria_id: null, recorrencia: "eventual",
    },
  })

  function openCreate() {
    form.reset({
      nome: "", valor: 0, vencimento: `${competencia}-05`,
      categoria_id: null, recorrencia: "eventual",
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    try {
      await createMutation.mutateAsync(values)
      toast.success("Compromisso criado")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar compromisso")
    }
  }

  const porCategoria = useMemo(() => {
    const grupos = new Map<string | null, NonNullable<typeof compromissos>>()
    for (const c of compromissos ?? []) {
      const lista = grupos.get(c.categoria_id) ?? []
      lista.push(c)
      grupos.set(c.categoria_id, lista)
    }
    return grupos
  }, [compromissos])

  const semCategoria = porCategoria.get(null) ?? []

  const faturas = useMemo(() => {
    const porCartao = new Map<string, { cartaoNome: string; diaVencimento: number; total: number; pendentes: number }>()
    for (const parcela of parcelas ?? []) {
      const compra = parcela.compras_parceladas
      if (!compra) continue
      const atual = porCartao.get(compra.cartao_id)
        ?? { cartaoNome: compra.cartoes.nome, diaVencimento: compra.cartoes.dia_vencimento, total: 0, pendentes: 0 }
      atual.total += parcela.valor
      if (parcela.status === "pendente") atual.pendentes += 1
      porCartao.set(compra.cartao_id, atual)
    }
    return Array.from(porCartao.entries()).map(([cartaoId, dados]) => ({ cartaoId, ...dados }))
  }, [parcelas])

  const parcelasPorCartao = useMemo(() => {
    const mapa = new Map<string, NonNullable<typeof parcelas>>()
    for (const parcela of parcelas ?? []) {
      const cartaoId = parcela.compras_parceladas?.cartao_id
      if (!cartaoId) continue
      const lista = mapa.get(cartaoId) ?? []
      lista.push(parcela)
      mapa.set(cartaoId, lista)
    }
    return mapa
  }, [parcelas])

  const totalComprometido = (compromissos?.reduce((acc, c) => acc + c.valor, 0) ?? 0)
    + (parcelas?.reduce((acc, p) => acc + p.valor, 0) ?? 0)
  const totalPendente = (compromissos?.filter((c) => c.status === "pendente").reduce((acc, c) => acc + c.valor, 0) ?? 0)
    + (parcelas?.filter((p) => p.status === "pendente").reduce((acc, p) => acc + p.valor, 0) ?? 0)

  async function onToggleParcela(parcelaId: string, pago: boolean) {
    try {
      await marcarParcelaPagaMutation.mutateAsync({ id: parcelaId, status: pago ? "pago" : "pendente" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar parcela")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Compromissos — {formatarCompetencia(competencia)}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Novo compromisso
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo compromisso</DialogTitle>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total comprometido</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatarMoeda(totalComprometido, moedaPadrao)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ainda pendente</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-amber-600">{formatarMoeda(totalPendente, moedaPadrao)}</CardContent>
        </Card>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (() => {
        const tiles: { key: string; node: ReactNode }[] = []

        for (const categoria of categorias ?? []) {
          const itens = porCategoria.get(categoria.id) ?? []
          const total = itens.reduce((acc, c) => acc + c.valor, 0)
          const pendentes = itens.filter((c) => c.status === "pendente").length
          const isOpen = abertos.has(categoria.id)
          const cor = corDaCategoria(categoria.id, categorias ?? [])
          tiles.push({
            key: categoria.id,
            node: (
              <Collapsible open={isOpen} onOpenChange={() => toggleAberto(categoria.id)} asChild>
                <Card className="h-fit border-l-4 transition-colors" style={{ borderLeftColor: cor }}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer flex-row items-center justify-between gap-2 hover:bg-accent/40">
                      <div className="flex items-center gap-2">
                        <Layers className="size-5" style={{ color: cor }} />
                        <CardTitle className="text-base">{categoria.nome}</CardTitle>
                      </div>
                      {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p className="text-lg font-semibold text-foreground">{formatarMoeda(total, moedaPadrao)}</p>
                    <p>{itens.length === 0 ? "Nada neste mês" : `${pendentes} pendente(s) de ${itens.length}`}</p>
                  </CardContent>
                  <CollapsibleContent>
                    <CardContent className="pt-2">
                      <CompromissoCategoriaPainel
                        categoriaId={categoria.id}
                        itens={itens}
                        isLoading={isLoading}
                        vencimentoPadrao={`${competencia}-05`}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ),
          })
        }

        if (semCategoria.length > 0) {
          const isOpen = abertos.has(SEM_CATEGORIA_ID)
          tiles.push({
            key: SEM_CATEGORIA_ID,
            node: (
              <Collapsible open={isOpen} onOpenChange={() => toggleAberto(SEM_CATEGORIA_ID)} asChild>
                <Card className="h-fit transition-colors">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer flex-row items-center justify-between gap-2 hover:bg-accent/40">
                      <div className="flex items-center gap-2">
                        <Layers className="size-5 text-muted-foreground" />
                        <CardTitle className="text-base">Sem categoria</CardTitle>
                      </div>
                      {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p className="text-lg font-semibold text-foreground">
                      {formatarMoeda(semCategoria.reduce((acc, c) => acc + c.valor, 0), moedaPadrao)}
                    </p>
                    <p>{semCategoria.filter((c) => c.status === "pendente").length} pendente(s) de {semCategoria.length}</p>
                  </CardContent>
                  <CollapsibleContent>
                    <CardContent className="pt-2">
                      <CompromissoCategoriaPainel
                        categoriaId={null}
                        itens={semCategoria}
                        isLoading={isLoading}
                        vencimentoPadrao={`${competencia}-05`}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ),
          })
        }

        for (const fatura of faturas) {
          const id = `fatura-${fatura.cartaoId}`
          const isOpen = abertos.has(id)
          const parcelasDoCartao = parcelasPorCartao.get(fatura.cartaoId) ?? []
          tiles.push({
            key: id,
            node: (
              <Collapsible open={isOpen} onOpenChange={() => toggleAberto(id)} asChild>
                <Card className="h-fit border-l-4 border-l-primary transition-colors">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer flex-row items-center justify-between gap-2 hover:bg-accent/40">
                      <div className="flex items-center gap-2">
                        <CreditCard className="size-5 text-primary" />
                        <CardTitle className="text-base">Fatura {fatura.cartaoNome}</CardTitle>
                      </div>
                      {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p className="text-lg font-semibold text-foreground">{formatarMoeda(fatura.total, moedaPadrao)}</p>
                    <p>{fatura.pendentes} pendente(s) · vence dia {fatura.diaVencimento}</p>
                  </CardContent>
                  <CollapsibleContent>
                    <CardContent className="space-y-2 pt-2">
                      {parcelasDoCartao.map((parcela) => (
                        <label
                          key={parcela.id}
                          className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer"
                        >
                          <div className={cn(parcela.status === "pago" && "line-through text-muted-foreground")}>
                            <p className="font-medium">{parcela.compras_parceladas?.descricao}</p>
                            <p className="text-muted-foreground">{formatarMoeda(parcela.valor, moedaPadrao)}</p>
                          </div>
                          <Checkbox
                            checked={parcela.status === "pago"}
                            onCheckedChange={(checked) => onToggleParcela(parcela.id, checked === true)}
                            aria-label="Marcar parcela como paga"
                          />
                        </label>
                      ))}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ),
          })
        }

        if (tiles.length === 0) {
          return (
            <p className="text-sm text-muted-foreground">
              Nenhuma categoria cadastrada ainda — crie uma em "Categorias" ou um compromisso sem categoria.
            </p>
          )
        }

        const colunaEsquerda = tiles.filter((_, i) => i % 2 === 0)
        const colunaDireita = tiles.filter((_, i) => i % 2 === 1)

        return (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex flex-1 flex-col gap-3">
              {colunaEsquerda.map((t) => <div key={t.key}>{t.node}</div>)}
            </div>
            <div className="flex flex-1 flex-col gap-3">
              {colunaDireita.map((t) => <div key={t.key}>{t.node}</div>)}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
