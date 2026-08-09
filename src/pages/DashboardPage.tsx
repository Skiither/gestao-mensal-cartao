import { Wallet, Receipt, AlertCircle, PiggyBank, TrendingUp, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useReceitas } from "@/hooks/useReceitas"
import { useCompromissos } from "@/hooks/useCompromissos"
import { useParcelasDaCompetencia } from "@/hooks/useComprasParceladas"
import { moedasNoHistorico, usePatrimonioHistorico, valorAtualPorTipo } from "@/hooks/usePatrimonio"
import { useMetas } from "@/hooks/useMetas"
import { useCompetencia } from "@/contexts/CompetenciaContext"
import { useAuth } from "@/contexts/AuthContext"
import { formatarCompetencia } from "@/lib/competencia"
import { formatarMoeda } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Moeda } from "@/types/database"

const TONS = {
  success: { valor: "text-success", chip: "bg-success/15 text-success" },
  primary: { valor: "text-primary", chip: "bg-primary/10 text-primary" },
  warning: { valor: "text-warning", chip: "bg-warning/15 text-warning" },
  destructive: { valor: "text-destructive", chip: "bg-destructive/10 text-destructive" },
} as const
type Tom = keyof typeof TONS

export function DashboardPage() {
  const { moedaPadrao } = useAuth()
  const { competencia } = useCompetencia()
  const { data: receitas, isLoading: loadingReceitas } = useReceitas(competencia)
  const { data: compromissos, isLoading: loadingCompromissos } = useCompromissos(competencia)
  const { data: parcelas, isLoading: loadingParcelas } = useParcelasDaCompetencia(competencia)
  const { data: patrimonioHistorico } = usePatrimonioHistorico()
  const { data: metas } = useMetas()

  const carregando = loadingReceitas || loadingCompromissos || loadingParcelas

  const totalReceitas = receitas?.reduce((acc, r) => acc + r.valor, 0) ?? 0
  const totalCompromissos = compromissos?.reduce((acc, c) => acc + c.valor, 0) ?? 0
  const totalParcelas = parcelas?.reduce((acc, p) => acc + p.valor, 0) ?? 0
  const totalComprometido = totalCompromissos + totalParcelas

  const faltaPagarCompromissos = compromissos?.filter((c) => c.status === "pendente").reduce((acc, c) => acc + c.valor, 0) ?? 0
  const faltaPagarParcelas = parcelas?.filter((p) => p.status === "pendente").reduce((acc, p) => acc + p.valor, 0) ?? 0
  const faltaPagar = faltaPagarCompromissos + faltaPagarParcelas

  const saldo = totalReceitas - totalComprometido
  const tomSaldo: Tom = saldo >= 0 ? "success" : "destructive"

  const moedasPatrimonio = patrimonioHistorico ? moedasNoHistorico(patrimonioHistorico) : []
  const guardadoPorMoeda = moedasPatrimonio.map((m) => ({
    moeda: m, valor: valorAtualPorTipo(patrimonioHistorico ?? [], "guardado", m),
  }))
  const investidoPorMoeda = moedasPatrimonio.map((m) => ({
    moeda: m, valor: valorAtualPorTipo(patrimonioHistorico ?? [], "investido", m),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground capitalize">{formatarCompetencia(competencia)}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResumoCard
          titulo="Entradas do mês"
          valor={totalReceitas}
          moeda={moedaPadrao}
          icone={Wallet}
          tom="success"
          loading={carregando}
        />
        <ResumoCard
          titulo="Total comprometido"
          valor={totalComprometido}
          moeda={moedaPadrao}
          icone={Receipt}
          tom="primary"
          loading={carregando}
          subtitulo={`${formatarMoeda(totalCompromissos, moedaPadrao)} compromissos + ${formatarMoeda(totalParcelas, moedaPadrao)} parcelas`}
        />
        <ResumoCard
          titulo="Falta pagar"
          valor={faltaPagar}
          moeda={moedaPadrao}
          icone={AlertCircle}
          tom={faltaPagar > 0 ? "warning" : "success"}
          loading={carregando}
        />
        <Card className={cn("border-t-4", tomSaldo === "success" ? "border-t-success" : "border-t-destructive")}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className={cn("flex size-8 items-center justify-center rounded-lg", TONS[tomSaldo].chip)}>
                <TrendingUp className="size-4" />
              </span>
              Sobra do mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <p className={cn("text-2xl font-bold tabular-nums", TONS[tomSaldo].valor)}>
                {formatarMoeda(saldo, moedaPadrao)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ResumoCardMultiMoeda titulo="Guardado" valores={guardadoPorMoeda} icone={PiggyBank} tom="primary" />
        <ResumoCardMultiMoeda titulo="Investido" valores={investidoPorMoeda} icone={TrendingUp} tom="primary" />
        <ResumoCardMultiMoeda
          titulo="Patrimônio total"
          valores={moedasPatrimonio.map((moeda) => ({
            moeda,
            valor: (guardadoPorMoeda.find((g) => g.moeda === moeda)?.valor ?? 0)
              + (investidoPorMoeda.find((i) => i.moeda === moeda)?.valor ?? 0),
          }))}
          icone={PiggyBank}
          tom="primary"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className={cn("flex size-8 items-center justify-center rounded-lg", TONS.primary.chip)}>
              <Target className="size-4" />
            </span>
            Progresso das metas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!metas || metas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>
          ) : (
            <div className="space-y-4">
              {metas.map((meta) => {
                const percentual = meta.valor_desejado > 0
                  ? Math.min(100, (meta.valor_acumulado / meta.valor_desejado) * 100)
                  : 0
                return (
                  <div key={meta.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{meta.nome}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatarMoeda(meta.valor_acumulado, meta.moeda)} / {formatarMoeda(meta.valor_desejado, meta.moeda)}
                      </span>
                    </div>
                    <Progress value={percentual} />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ResumoCardMultiMoeda({
  titulo, valores, icone: Icone, tom,
}: {
  titulo: string
  valores: { moeda: Moeda; valor: number }[]
  icone: typeof Wallet
  tom: Tom
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={cn("flex size-8 items-center justify-center rounded-lg", TONS[tom].chip)}>
            <Icone className="size-4" />
          </span>
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {valores.length === 0 ? (
          <p className={cn("text-2xl font-bold tabular-nums", TONS[tom].valor)}>{formatarMoeda(0)}</p>
        ) : (
          valores.map(({ moeda, valor }) => (
            <p key={moeda} className={cn("text-2xl font-bold tabular-nums", TONS[tom].valor)}>{formatarMoeda(valor, moeda)}</p>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function ResumoCard({
  titulo, valor, moeda, icone: Icone, tom, loading, subtitulo,
}: {
  titulo: string
  valor: number
  moeda: Moeda
  icone: typeof Wallet
  tom: Tom
  loading?: boolean
  subtitulo?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={cn("flex size-8 items-center justify-center rounded-lg", TONS[tom].chip)}>
            <Icone className="size-4" />
          </span>
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <>
            <p className={cn("text-2xl font-bold tabular-nums", TONS[tom].valor)}>{formatarMoeda(valor, moeda)}</p>
            {subtitulo && <p className="mt-1 text-xs text-muted-foreground">{subtitulo}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}
