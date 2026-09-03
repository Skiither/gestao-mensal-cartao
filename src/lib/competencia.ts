const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export const MESES_CURTOS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
]

/** Competência no formato 'YYYY-MM'. */
export type Competencia = string

export function competenciaAtual(): Competencia {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function formatarCompetencia(competencia: Competencia): string {
  const [ano, mes] = competencia.split("-").map(Number)
  return `${MESES[mes - 1]} de ${ano}`
}

/** Versão curta ('Set 2026') — para telas estreitas. */
export function formatarCompetenciaCurta(competencia: Competencia): string {
  const [ano, mes] = competencia.split("-").map(Number)
  return `${MESES_CURTOS[mes - 1]} ${ano}`
}

/** Quebra 'YYYY-MM' em ano e mês (1-12) numéricos. */
export function partesCompetencia(competencia: Competencia): { ano: number; mes: number } {
  const [ano, mes] = competencia.split("-").map(Number)
  return { ano, mes }
}

/** Monta 'YYYY-MM' a partir de ano e mês (1-12). */
export function montarCompetencia(ano: number, mes: number): Competencia {
  return `${ano}-${String(mes).padStart(2, "0")}`
}

export function competenciaAdjacente(competencia: Competencia, delta: number): Competencia {
  const [ano, mes] = competencia.split("-").map(Number)
  const data = new Date(ano, mes - 1 + delta, 1)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
}

export function proximaCompetencia(competencia: Competencia): Competencia {
  return competenciaAdjacente(competencia, 1)
}

/** Competência ('YYYY-MM') a que pertence uma data/timestamp ISO, no fuso local do navegador. */
export function competenciaDeData(dataISO: string): Competencia {
  const data = new Date(dataISO)
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
}

/** Últimas `quantidade` competências terminando em `competencia`, da mais antiga pra mais recente. */
export function ultimasCompetencias(competencia: Competencia, quantidade: number): Competencia[] {
  const lista: Competencia[] = []
  for (let i = quantidade - 1; i >= 0; i--) {
    lista.push(competenciaAdjacente(competencia, -i))
  }
  return lista
}
