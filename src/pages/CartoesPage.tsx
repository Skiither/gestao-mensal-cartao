import { useMemo, useState, type MouseEvent } from "react"
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
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { DivisaoDonut } from "@/components/DivisaoDonut"
import { useCartoes, useCreateCartao, useUpdateCartao, useDeleteCartao } from "@/hooks/useCartoes"
import {
  useParcelasDaCompetencia, useQuantidadeComprasAtivasPorCartao, useTotalPendentePorCartao,
} from "@/hooks/useComprasParceladas"
import { useAuth } from "@/contexts/AuthContext"
import { useCompetencia } from "@/contexts/CompetenciaContext"
import { formatarCompetencia, formatarCompetenciaCurta } from "@/lib/competencia"
import { formatarMoeda } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Cartao } from "@/types/database"

const schema = z.object({
  nome: z.string().min(1, "Informe um nome"),
  limite: z.coerce.number().nonnegative().optional(),
  dia_fechamento: z.coerce.number().int().min(1).max(31),
  dia_vencimento: z.coerce.number().int().min(1).max(31),
})

type FormValues = z.output<typeof schema>
type FormInput = z.input<typeof schema>

// Cores da rosca de cartões — por posição, não por nome (cartão não tem cor fixa no resto do app).
const CORES_CARTAO = ["#2a78d6", "#e34948", "#eda100", "#1baf7a", "#8a5cf6", "#e87ba4", "#0ca30c"]

export function CartoesPage() {
  const { moedaPadrao } = useAuth()
  const { competencia } = useCompetencia()
  const { data: cartoes, isLoading } = useCartoes()
  const { data: totalPendentePorCartao } = useTotalPendentePorCartao()
  const { data: parcelasMes } = useParcelasDaCompetencia(competencia)
  const { data: quantidadeComprasPorCartao } = useQuantidadeComprasAtivasPorCartao()
  const createMutation = useCreateCartao()
  const updateMutation = useUpdateCartao()
  const deleteMutation = useDeleteCartao()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Cartao | null>(null)
  const [visao, setVisao] = useState<"mes" | "total">("mes")

  // Cor fixa por cartão (mesma nas duas visões), pela posição na lista.
  const corDoCartao = useMemo(() => {
    const m = new Map<string, string>()
    ;(cartoes ?? []).forEach((c, i) => m.set(c.id, CORES_CARTAO[i % CORES_CARTAO.length]))
    return m
  }, [cartoes])

  // "Total": tudo que ainda falta pagar somando todos os meses.
  const fatiasTotal = useMemo(() => {
    if (!cartoes) return []
    return cartoes
      .map((c) => ({ nome: c.nome, valor: totalPendentePorCartao?.get(c.id) ?? 0, cor: corDoCartao.get(c.id)! }))
      .filter((f) => f.valor > 0)
      .sort((a, b) => b.valor - a.valor)
  }, [cartoes, totalPendentePorCartao, corDoCartao])

  // "Mês": fatura de cada cartão na competência selecionada.
  const fatiasMes = useMemo(() => {
    if (!cartoes || !parcelasMes) return []
    const porCartao = new Map<string, number>()
    for (const p of parcelasMes) {
      const id = p.compras_parceladas?.cartao_id
      if (!id) continue
      porCartao.set(id, (porCartao.get(id) ?? 0) + p.valor)
    }
    return cartoes
      .map((c) => ({ nome: c.nome, valor: porCartao.get(c.id) ?? 0, cor: corDoCartao.get(c.id)! }))
      .filter((f) => f.valor > 0)
      .sort((a, b) => b.valor - a.valor)
  }, [cartoes, parcelasMes, corDoCartao])

  const fatias = visao === "mes" ? fatiasMes : fatiasTotal
  // Rosca só aparece a partir de 2 cartões cadastrados e havendo algo pra dividir.
  const mostrarGrafico = (cartoes?.length ?? 0) >= 2 && (fatiasTotal.length > 0 || fatiasMes.length > 0)

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

  async function onDelete(id: string) {
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

      {mostrarGrafico && (
        <DivisaoDonut
          titulo="Divisão por cartão"
          fatias={fatias}
          moeda={moedaPadrao}
          vazio={
            visao === "mes"
              ? `Nada a pagar nos cartões em ${formatarCompetencia(competencia)}.`
              : "Nenhuma fatura em aberto."
          }
          acao={
            <div className="flex shrink-0 rounded-md border p-0.5">
              <button
                type="button"
                onClick={() => setVisao("mes")}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium capitalize transition-colors",
                  visao === "mes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {formatarCompetenciaCurta(competencia)}
              </button>
              <button
                type="button"
                onClick={() => setVisao("total")}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium transition-colors",
                  visao === "total" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Total
              </button>
            </div>
          }
        />
      )}

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
                    <ConfirmDialog
                      title="Excluir cartão?"
                      description={`Isso vai excluir o cartão "${cartao.nome}" e todas as compras parceladas dele, permanentemente.`}
                      onConfirm={() => onDelete(cartao.id)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={(e) => e.preventDefault()}
                          aria-label="Excluir"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      }
                    />
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
