import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { ArrowLeft, ChevronDown, ChevronUp, Pencil, Plus, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCartao } from "@/hooks/useCartoes"
import {
  useComprasParceladas, useCreateCompraParcelada, useDeleteCompraParcelada, useMarcarParcelaPaga,
  useParcelasDaCompra, useResumoParcelasPorCartao, useTotalPendentePorCartao, useUpdateCompraParcelada,
  type ResumoParcelas,
} from "@/hooks/useComprasParceladas"
import { useCompetencia } from "@/contexts/CompetenciaContext"
import { useAuth } from "@/contexts/AuthContext"
import { formatarCompetencia } from "@/lib/competencia"
import { formatarMoeda } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { CompraParcelada } from "@/types/database"

const schema = z.object({
  descricao: z.string().min(1, "Informe uma descrição"),
  valor_total: z.coerce.number().positive("O valor deve ser maior que zero"),
  quantidade_parcelas: z.coerce.number().int().min(1, "Mínimo de 1 parcela"),
  mes_inicial: z.string().min(1, "Informe o mês inicial"),
  pessoas: z.coerce.number().int().min(1, "Mínimo de 1 pessoa"),
})

type FormValues = z.output<typeof schema>
type FormInput = z.input<typeof schema>

export function CartaoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const { moedaPadrao } = useAuth()
  const { competencia } = useCompetencia()
  const { data: cartao } = useCartao(id)
  const { data: compras, isLoading } = useComprasParceladas(id)
  const { data: totalPendentePorCartao } = useTotalPendentePorCartao()
  const { data: resumoPorCompra } = useResumoParcelasPorCartao(id)
  const createMutation = useCreateCompraParcelada()
  const updateMutation = useUpdateCompraParcelada()
  const deleteMutation = useDeleteCompraParcelada()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CompraParcelada | null>(null)
  const [mostrarQuitadas, setMostrarQuitadas] = useState(false)

  const comprasAtivas = compras?.filter((compra) => {
    const resumo = resumoPorCompra?.get(compra.id)
    return !resumo || resumo.pagas < resumo.total
  })
  const comprasQuitadas = compras?.filter((compra) => {
    const resumo = resumoPorCompra?.get(compra.id)
    return resumo && resumo.total > 0 && resumo.pagas === resumo.total
  })

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { descricao: "", valor_total: 0, quantidade_parcelas: 1, mes_inicial: competencia, pessoas: 1 },
  })

  const valorTotal = form.watch("valor_total")
  const quantidadeParcelas = form.watch("quantidade_parcelas")
  const pessoas = form.watch("pessoas")
  const previaValorParcela =
    Number(valorTotal) > 0 && Number(quantidadeParcelas) > 0 && Number(pessoas) > 0
      ? Number(valorTotal) / Number(quantidadeParcelas) / Number(pessoas)
      : null

  function openCreate() {
    setEditing(null)
    form.reset({ descricao: "", valor_total: 0, quantidade_parcelas: 1, mes_inicial: competencia, pessoas: 1 })
    setOpen(true)
  }

  function openEdit(compra: CompraParcelada) {
    setEditing(compra)
    form.reset({
      descricao: compra.descricao,
      valor_total: compra.valor_total,
      quantidade_parcelas: compra.quantidade_parcelas,
      mes_inicial: compra.mes_inicial,
      pessoas: compra.pessoas,
    })
    setOpen(true)
  }

  async function onSubmit(values: FormValues) {
    if (!id) return
    try {
      if (editing) {
        await updateMutation.mutateAsync({ ...values, id: editing.id, cartao_id: id })
        toast.success("Compra parcelada atualizada — parcelas recalculadas")
      } else {
        await createMutation.mutateAsync({ ...values, cartao_id: id })
        toast.success("Compra parcelada criada — parcelas geradas automaticamente")
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar compra parcelada")
    }
  }

  async function onDelete(compraId: string) {
    try {
      await deleteMutation.mutateAsync(compraId)
      toast.success("Compra parcelada excluída")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir compra")
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/cartoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar para cartões
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{cartao?.nome ?? "Cartão"}</h1>
          {cartao && (
            <p className="text-sm text-muted-foreground">
              {cartao.limite != null && (
                <>
                  {`Limite: ${formatarMoeda(cartao.limite, moedaPadrao)} · `}
                  {`Disponível: ${formatarMoeda(cartao.limite - (totalPendentePorCartao?.get(cartao.id) ?? 0), moedaPadrao)} · `}
                </>
              )}
              {`Fecha dia ${cartao.dia_fechamento}, vence dia ${cartao.dia_vencimento} · `}
              {comprasAtivas?.length ?? 0} {comprasAtivas?.length === 1 ? "compra ativa" : "compras ativas"}
            </p>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Nova compra parcelada
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar compra parcelada" : "Nova compra parcelada"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Notebook" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valor_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor total</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} value={field.value as number} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantidade_parcelas"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nº de parcelas</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} value={field.value as number} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mes_inicial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mês inicial</FormLabel>
                        <FormControl>
                          <Input type="month" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="pessoas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dividir entre quantas pessoas?</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} value={field.value as number} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        1 = a compra é só sua. Acima disso, o valor total é dividido igualmente e cada
                        parcela reflete apenas a sua parte.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {previaValorParcela != null && (
                  <p className="text-sm text-muted-foreground">
                    Sua parcela: <span className="font-medium text-foreground">{formatarMoeda(previaValorParcela, moedaPadrao)}</span>
                    {" "}× {Number(quantidadeParcelas)}
                  </p>
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
      ) : !compras || compras.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma compra parcelada neste cartão.</p>
      ) : (
        <>
          {!comprasAtivas || comprasAtivas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma compra ativa — tudo quitado por aqui.</p>
          ) : (
            <div className="space-y-3">
              {comprasAtivas.map((compra) => (
                <CompraParceladaCard
                  key={compra.id}
                  compra={compra}
                  resumo={resumoPorCompra?.get(compra.id)}
                  onEdit={() => openEdit(compra)}
                  onDelete={() => onDelete(compra.id)}
                />
              ))}
            </div>
          )}

          {comprasQuitadas && comprasQuitadas.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setMostrarQuitadas((v) => !v)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                {mostrarQuitadas ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                {comprasQuitadas.length} {comprasQuitadas.length === 1 ? "compra quitada" : "compras quitadas"}
              </button>
              {mostrarQuitadas && (
                <div className="mt-3 space-y-3">
                  {comprasQuitadas.map((compra) => (
                    <CompraParceladaCard
                      key={compra.id}
                      compra={compra}
                      resumo={resumoPorCompra?.get(compra.id)}
                      onEdit={() => openEdit(compra)}
                      onDelete={() => onDelete(compra.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CompraParceladaCard({
  compra, resumo, onEdit, onDelete,
}: { compra: CompraParcelada; resumo: ResumoParcelas | undefined; onEdit: () => void; onDelete: () => void }) {
  const { moedaPadrao } = useAuth()
  const [expandido, setExpandido] = useState(false)
  const { data: parcelas } = useParcelasDaCompra(expandido ? compra.id : undefined)
  const marcarPagaMutation = useMarcarParcelaPaga()

  function onToggleParcela(parcelaId: string, pago: boolean) {
    marcarPagaMutation.mutate({ id: parcelaId, status: pago ? "pago" : "pendente" })
  }

  return (
    <Card>
      <CardHeader
        className="cursor-pointer flex-row items-center justify-between"
        onClick={() => setExpandido((v) => !v)}
      >
        <div>
          <CardTitle className="text-base">{compra.descricao}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {compra.quantidade_parcelas}x de {formatarMoeda(compra.valor_parcela, moedaPadrao)} · total {formatarMoeda(compra.valor_total, moedaPadrao)}
          </p>
          {compra.pessoas > 1 && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" /> Dividido entre {compra.pessoas} pessoas — sua parte já calculada acima
            </p>
          )}
          {resumo && (
            <p className="text-sm text-muted-foreground">
              {resumo.pagas}/{resumo.total} parcelas pagas · Sua parte — pago: {formatarMoeda(resumo.valorPago, moedaPadrao)}, falta: {formatarMoeda(resumo.valorTotal - resumo.valorPago, moedaPadrao)}
            </p>
          )}
          {resumo && compra.pessoas > 1 && (
            <p className="text-xs text-muted-foreground">
              Fatura toda (÷{compra.pessoas}) — pago: {formatarMoeda(resumo.valorPago * compra.pessoas, moedaPadrao)}, falta: {formatarMoeda((resumo.valorTotal - resumo.valorPago) * compra.pessoas, moedaPadrao)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            aria-label="Editar compra"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            aria-label="Excluir compra"
          >
            <Trash2 className="size-4" />
          </Button>
          {expandido ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </CardHeader>
      {expandido && (
        <CardContent>
          {!parcelas ? (
            <p className="text-sm text-muted-foreground">Carregando parcelas...</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {parcelas.map((parcela) => (
                <label
                  key={parcela.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer"
                >
                  <div className={cn(parcela.status === "pago" && "line-through text-muted-foreground")}>
                    <p className="font-medium">{parcela.numero_parcela}/{compra.quantidade_parcelas}</p>
                    <p className="text-muted-foreground">{formatarCompetencia(parcela.competencia)}</p>
                  </div>
                  <Checkbox
                    checked={parcela.status === "pago"}
                    onCheckedChange={(checked) => onToggleParcela(parcela.id, checked === true)}
                    aria-label="Marcar parcela como paga"
                  />
                </label>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
