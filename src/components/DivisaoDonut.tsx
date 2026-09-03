import type { ReactNode } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatarMoeda } from "@/lib/format"
import type { Moeda } from "@/types/database"

export type FatiaDonut = { nome: string; cor: string; valor: number }

/** Rosca de divisão (categorias, cartões...) com total no centro e lista com % ao lado. */
export function DivisaoDonut({
  titulo,
  fatias,
  moeda,
  acao,
  vazio = "Nada para mostrar.",
}: {
  titulo: string
  fatias: FatiaDonut[]
  moeda: Moeda
  /** Conteúdo à direita do título (ex: botões de alternar visão). */
  acao?: ReactNode
  /** Mensagem quando não há fatias. */
  vazio?: string
}) {
  const total = fatias.reduce((acc, f) => acc + f.valor, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{titulo}</CardTitle>
        {acao}
      </CardHeader>
      <CardContent>
        {fatias.length === 0 ? (
          <p className="text-sm text-muted-foreground">{vazio}</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-48 w-full sm:w-48 sm:shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fatias}
                    dataKey="valor"
                    nameKey="nome"
                    innerRadius="60%"
                    outerRadius="100%"
                    paddingAngle={1}
                    stroke="none"
                  >
                    {fatias.map((f) => (
                      <Cell key={f.nome} fill={f.cor} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatarMoeda(Number(value), moeda)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[0.68rem] text-muted-foreground">Total</span>
                <span className="mt-0.5 font-mono text-sm font-medium tabular-nums">
                  {formatarMoeda(total, moeda)}
                </span>
              </div>
            </div>

            <ul className="w-full space-y-1.5 sm:max-w-md">
              {fatias.map((f) => (
                <li key={f.nome} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ backgroundColor: f.cor }}
                  />
                  <span className="flex-1 truncate">{f.nome}</span>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {total > 0 ? `${((f.valor / total) * 100).toFixed(1)}%` : "—"}
                  </span>
                  <span className="w-24 text-right font-mono font-medium tabular-nums">
                    {formatarMoeda(f.valor, moeda)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
