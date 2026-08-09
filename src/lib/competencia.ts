const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

/** Competência no formato 'YYYY-MM'. */
export type Competencia = string

export function competenciaAtual(): Competencia {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function formatarCompetencia(competencia: Competencia): string {
  const [ano, mes] = competencia.split("-").map(Number)
  return `${MESES[mes - 1]}/${ano}`
}

export function competenciaAdjacente(competencia: Competencia, delta: number): Competencia {
  const [ano, mes] = competencia.split("-").map(Number)
  const data = new Date(ano, mes - 1 + delta, 1)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
}

export function proximaCompetencia(competencia: Competencia): Competencia {
  return competenciaAdjacente(competencia, 1)
}

/** Últimas `quantidade` competências terminando em `competencia`, da mais antiga pra mais recente. */
export function ultimasCompetencias(competencia: Competencia, quantidade: number): Competencia[] {
  const lista: Competencia[] = []
  for (let i = quantidade - 1; i >= 0; i--) {
    lista.push(competenciaAdjacente(competencia, -i))
  }
  return lista
}
