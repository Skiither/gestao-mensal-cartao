import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { BalancoDoMes } from "@/components/BalancoDoMes"
import { useReceitas } from "@/hooks/useReceitas"
import { useCompromissos } from "@/hooks/useCompromissos"
import { useParcelasDaCompetencia } from "@/hooks/useComprasParceladas"
import { usePatrimonioItens, totalPorMoeda } from "@/hooks/usePatrimonioItens"
import { useMetas } from "@/hooks/useMetas"
import { useCompetencia } from "@/contexts/CompetenciaContext"
import { useAuth } from "@/contexts/AuthContext"
import { formatarCompetencia } from "@/lib/competencia"
import { formatarMoeda } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Moeda } from "@/types/database"

const TONS = {
  success: "text-success",
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
} as const
type Tom = keyof typeof TONS

export function DashboardPage() {
  const { moedaPadrao } = useAuth()
  const { competencia } = useCompetencia()
  const { data: receitas, isLoading: loadingReceitas } = useReceitas(competencia)
  const { data: compromissos, isLoading: loadingCompromissos } = useCompromissos(competencia)
  const { data: parcelas, isLoading: loadingParcelas } = useParcelasDaCompetencia(competencia)
  const { data: patrimonioItens } = usePatrimonioItens()
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

  const itensPatrimonio = patrimonioItens ?? []
  const saldoGeralPorMoeda = totalPorMoeda(itensPatrimonio, "conta")
  const guardadoPorMoeda = totalPorMoeda(itensPatrimonio, "guardado")
  const investidoPorMoeda = totalPorMoeda(itensPatrimonio, "investido")
  const moedasPatrimonio = Array.from(new Set([
    ...saldoGeralPorMoeda.map((v) => v.moeda),
    ...guardadoPorMoeda.map((v) => v.moeda),
    ...investidoPorMoeda.map((v) => v.moeda),
  ]))

  return (
    <div>
      <div className="mb-[1.6rem]">
        <h1 className="font-heading text-[clamp(1.9rem,4vw,2.6rem)] font-normal leading-[1.05] tracking-tight">Painel</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{formatarCompetencia(competencia)}</p>
      </div>

      <div className="mb-[0.9rem] grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResumoCard
          titulo="Entradas do mês"
          valor={totalReceitas}
          moeda={moedaPadrao}
          tom="success"
          loading={carregando}
          to="/receitas"
        />
        <ResumoCard
          titulo="Total comprometido"
          valor={totalComprometido}
          moeda={moedaPadrao}
          tom="warning"
          loading={carregando}
          subtitulo={`${formatarMoeda(totalCompromissos, moedaPadrao)} compromissos + ${formatarMoeda(totalParcelas, moedaPadrao)} cartão`}
          to="/compromissos"
        />
        <ResumoCard
          titulo="Falta pagar"
          valor={faltaPagar}
          moeda={moedaPadrao}
          tom="destructive"
          loading={carregando}
          to="/compromissos"
        />
        <ResumoCard
          titulo="Sobra do mês"
          valor={saldo}
          moeda={moedaPadrao}
          tom="info"
          loading={carregando}
        />
      </div>

      <div className="mb-[1.4rem] grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResumoCardMultiMoeda titulo="Saldo geral" valores={saldoGeralPorMoeda} tom="primary" to="/patrimonio" />
        <ResumoCardMultiMoeda titulo="Guardado" valores={guardadoPorMoeda} tom="primary" to="/patrimonio" />
        <ResumoCardMultiMoeda titulo="Investido" valores={investidoPorMoeda} tom="primary" to="/patrimonio" />
        <ResumoCardMultiMoeda
          titulo="Patrimônio total"
          valores={moedasPatrimonio.map((moeda) => ({
            moeda,
            valor: (saldoGeralPorMoeda.find((v) => v.moeda === moeda)?.valor ?? 0)
              + (guardadoPorMoeda.find((v) => v.moeda === moeda)?.valor ?? 0)
              + (investidoPorMoeda.find((v) => v.moeda === moeda)?.valor ?? 0),
          }))}
          tom="primary"
          to="/patrimonio"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <Link to="/metas" className="hover:underline">Progresso das metas</Link>
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
                  <div key={meta.id} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{meta.nome}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
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

      <h2 className="mt-8 mb-[0.9rem] font-heading text-[1.3rem] font-medium tracking-tight">Balanço do mês</h2>
      <BalancoDoMes />
    </div>
  )
}

const STAT_BOX = "block h-full rounded-lg border border-border bg-card px-4 pt-3.5 pb-4"
const STAT_LAB = "font-mono text-[0.66rem] font-medium tracking-[0.12em] text-muted-foreground uppercase"
const STAT_VAL = "mt-2 font-mono text-2xl tabular-nums tracking-tight leading-none"

function ResumoCardMultiMoeda({
  titulo, valores, tom, to,
}: {
  titulo: string
  valores: { moeda: Moeda; valor: number }[]
  tom: Tom
  to?: string
}) {
  const conteudo = (
    <div className={cn(STAT_BOX, to && "transition-colors hover:border-primary")}>
      <div className={STAT_LAB}>{titulo}</div>
      {valores.length === 0 ? (
        <p className={cn(STAT_VAL, TONS[tom])}>{formatarMoeda(0)}</p>
      ) : (
        valores.map(({ moeda, valor }, i) => (
          <p
            key={moeda}
            className={
              i === 0
                ? cn(STAT_VAL, TONS[tom])
                : "mt-0.5 font-mono text-sm tabular-nums text-muted-foreground"
            }
          >
            {formatarMoeda(valor, moeda)}
          </p>
        ))
      )}
    </div>
  )
  return to ? <Link to={to}>{conteudo}</Link> : conteudo
}

function ResumoCard({
  titulo, valor, moeda, tom, loading, subtitulo, to,
}: {
  titulo: string
  valor: number
  moeda: Moeda
  tom: Tom
  loading?: boolean
  subtitulo?: string
  to?: string
}) {
  const conteudo = (
    <div className={cn(STAT_BOX, to && "transition-colors hover:border-primary")}>
      <div className={STAT_LAB}>{titulo}</div>
      {loading ? (
        <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <p className={cn(STAT_VAL, TONS[tom])}>{formatarMoeda(valor, moeda)}</p>
          {subtitulo && <p className="mt-1.5 text-xs text-muted-foreground">{subtitulo}</p>}
        </>
      )}
    </div>
  )
  return to ? <Link to={to}>{conteudo}</Link> : conteudo
}
