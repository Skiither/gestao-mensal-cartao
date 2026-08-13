import { useMemo } from "react"
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCompromissos } from "@/hooks/useCompromissos"
import { useParcelasDaCompetencia } from "@/hooks/useComprasParceladas"
import { useCategorias } from "@/hooks/useCategorias"
import { useReceitas } from "@/hooks/useReceitas"
import { usePatrimonioHistorico } from "@/hooks/usePatrimonio"
import { useMetasHistorico } from "@/hooks/useMetas"
import { useCompetencia } from "@/contexts/CompetenciaContext"
import { useAuth } from "@/contexts/AuthContext"
import { competenciaDeData, formatarCompetencia } from "@/lib/competencia"
import { formatarMoeda } from "@/lib/format"
import { corPorNome } from "@/lib/categoriaColor"
import { cn } from "@/lib/utils"
import type { Moeda, Patrimonio, TipoPatrimonio } from "@/types/database"

const NOME_TIPO_PATRIMONIO: Record<TipoPatrimonio, string> = {
  guardado: "Guardado",
  investido: "Investido",
}

type MovimentoPatrimonio = {
  tipo: TipoPatrimonio
  moeda: Moeda
  anterior: number
  novo: number
  diferenca: number
  data: string
}

export function HistoricoPage() {
  const { moedaPadrao } = useAuth()
  const { competencia } = useCompetencia()
  const { data: compromissos, isLoading: loadingCompromissos } = useCompromissos(competencia)
  const { data: parcelas } = useParcelasDaCompetencia(competencia)
  const { data: categorias } = useCategorias()
  const { data: receitas } = useReceitas(competencia)
  const { data: patrimonioHistorico } = usePatrimonioHistorico()
  const { data: metasHistorico } = useMetasHistorico()

  const movimentacoesPatrimonio = useMemo(() => {
    if (!patrimonioHistorico) return []
    const porGrupo = new Map<string, Patrimonio[]>()
    for (const registro of patrimonioHistorico) {
      const chave = `${registro.tipo}|${registro.moeda}`
      const lista = porGrupo.get(chave) ?? []
      lista.push(registro)
      porGrupo.set(chave, lista)
    }
    const movimentos: MovimentoPatrimonio[] = []
    for (const lista of porGrupo.values()) {
      let anterior = 0
      for (const registro of lista) {
        const diferenca = registro.valor - anterior
        if (diferenca !== 0 && competenciaDeData(registro.atualizado_em) === competencia) {
          movimentos.push({
            tipo: registro.tipo, moeda: registro.moeda, anterior, novo: registro.valor, diferenca, data: registro.atualizado_em,
          })
        }
        anterior = registro.valor
      }
    }
    return movimentos.sort((a, b) => a.data.localeCompare(b.data))
  }, [patrimonioHistorico, competencia])

  const movimentacoesMetas = useMemo(() => {
    if (!metasHistorico) return []
    return metasHistorico
      .filter((h) => h.diferenca !== 0 && competenciaDeData(h.alterado_em) === competencia)
      .sort((a, b) => a.alterado_em.localeCompare(b.alterado_em))
  }, [metasHistorico, competencia])

  const porCategoria = useMemo(() => {
    const nomeDaCategoria = (id: string | null) => categorias?.find((c) => c.id === id)?.nome ?? "Sem categoria"
    const totais = new Map<string, number>()
    for (const c of compromissos ?? []) {
      const nome = nomeDaCategoria(c.categoria_id)
      totais.set(nome, (totais.get(nome) ?? 0) + c.valor)
    }

    const totalCartao = (parcelas ?? []).reduce((acc, p) => acc + p.valor, 0)
    if (totalCartao > 0) totais.set("Cartão de crédito", totalCartao)

    const totalComprometido = Array.from(totais.values()).reduce((acc, v) => acc + v, 0)
    const totalReceitas = (receitas ?? []).reduce((acc, r) => acc + r.valor, 0)
    const sobra = totalReceitas - totalComprometido

    const fatias = Array.from(totais.entries()).map(([nome, valor]) => ({ nome, valor }))
    if (sobra > 0) fatias.push({ nome: "Sobra", valor: sobra })
    return fatias
  }, [compromissos, categorias, parcelas, receitas])

  const faturas = useMemo(() => {
    const porCartao = new Map<string, { cartaoNome: string; total: number; compras: Set<string> }>()
    for (const parcela of parcelas ?? []) {
      const compra = parcela.compras_parceladas
      if (!compra) continue
      const atual = porCartao.get(compra.cartao_id)
        ?? { cartaoNome: compra.cartoes.nome, total: 0, compras: new Set<string>() }
      atual.total += parcela.valor
      atual.compras.add(parcela.compra_parcelada_id)
      porCartao.set(compra.cartao_id, atual)
    }
    return Array.from(porCartao.entries()).map(([cartaoId, dados]) => ({
      cartaoId,
      cartaoNome: dados.cartaoNome,
      total: dados.total,
      numCompras: dados.compras.size,
    }))
  }, [parcelas])

  const totalGeral = porCategoria.reduce((acc, f) => acc + f.valor, 0)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Histórico</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base capitalize">
            Distribuição do mês — {formatarCompetencia(competencia)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCompromissos ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : porCategoria.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada nesta competência.</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={porCategoria}
                    dataKey="valor"
                    nameKey="nome"
                    outerRadius="70%"
                    label={(props) => `${((props.percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {porCategoria.map((fatia) => (
                      <Cell key={fatia.nome} fill={corPorNome(fatia.nome)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatarMoeda(Number(value), moedaPadrao)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base capitalize">
            Faturas de cartão — {formatarCompetencia(competencia)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {faturas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma fatura nesta competência.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cartão</TableHead>
                  <TableHead>Nº de compras</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturas.map((fatura) => (
                  <TableRow key={fatura.cartaoId}>
                    <TableCell>{fatura.cartaoNome}</TableCell>
                    <TableCell>{fatura.numCompras}</TableCell>
                    <TableCell className="text-right">{formatarMoeda(fatura.total, moedaPadrao)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base capitalize">
            Movimentações de patrimônio — {formatarCompetencia(competencia)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {movimentacoesPatrimonio.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não houve movimentações de patrimônio neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>De → Para</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoesPatrimonio.map((mov, i) => (
                  <TableRow key={i}>
                    <TableCell>{NOME_TIPO_PATRIMONIO[mov.tipo]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatarMoeda(mov.anterior, mov.moeda)} → {formatarMoeda(mov.novo, mov.moeda)}
                    </TableCell>
                    <TableCell className={cn("text-right font-medium", mov.diferenca > 0 ? "text-success" : "text-destructive")}>
                      {mov.diferenca > 0 ? "+" : ""}{formatarMoeda(mov.diferenca, mov.moeda)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(mov.data).toLocaleDateString("pt-PT")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base capitalize">
            Movimentações de metas — {formatarCompetencia(competencia)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {movimentacoesMetas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não houve movimentações de metas neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meta</TableHead>
                  <TableHead>De → Para</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoesMetas.map((mov) => (
                  <TableRow key={mov.id}>
                    <TableCell>{mov.metas?.nome ?? "Meta excluída"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatarMoeda(mov.valor_anterior, mov.metas?.moeda)} → {formatarMoeda(mov.valor_novo, mov.metas?.moeda)}
                    </TableCell>
                    <TableCell className={cn("text-right font-medium", mov.diferenca > 0 ? "text-success" : "text-destructive")}>
                      {mov.diferenca > 0 ? "+" : ""}{formatarMoeda(mov.diferenca, mov.metas?.moeda)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(mov.alterado_em).toLocaleDateString("pt-PT")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base capitalize">
            Resumo por categoria — {formatarCompetencia(competencia)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {porCategoria.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada nesta competência.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCategoria.map((fatia) => (
                  <TableRow key={fatia.nome}>
                    <TableCell>{fatia.nome}</TableCell>
                    <TableCell className="text-right">{formatarMoeda(fatia.valor, moedaPadrao)}</TableCell>
                    <TableCell className="text-right">
                      {totalGeral > 0 ? `${((fatia.valor / totalGeral) * 100).toFixed(0)}%` : "—"}
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
