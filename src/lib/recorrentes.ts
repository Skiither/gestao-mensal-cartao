// Importa com ".js" porque este arquivo também roda no bot (api/), em ESM puro no Node.
import { proximaCompetencia, type Competencia } from "./competencia.js"
import type { CompromissoFinanceiro, Status } from "../types/database.js"

export type NovoCompromisso = Omit<CompromissoFinanceiro, "id" | "created_at">

export function diaDoMesClamped(vencimento: string, competenciaAlvo: string): string {
  const diaVencimento = Number(vencimento.split("-")[2])
  const [ano, mes] = competenciaAlvo.split("-").map(Number)
  const ultimoDiaDoMes = new Date(ano, mes, 0).getDate()
  const dia = Math.min(diaVencimento, ultimoDiaDoMes)
  return `${competenciaAlvo}-${String(dia).padStart(2, "0")}`
}

/**
 * Linhas que faltam para toda série recorrente ativa ter uma linha até `competencia`
 * (inclusive), geradas a partir da última linha conhecida de cada série (mesmo `serie_id`),
 * preservando o "dia" de vencimento. `linhas` são os compromissos recorrentes do usuário.
 */
export function recorrentesFaltando(
  linhas: CompromissoFinanceiro[],
  userId: string,
  competencia: Competencia,
): NovoCompromisso[] {
  // serie_id ainda não existe no banco (migração pendente) — sem ele não dá pra saber com
  // segurança quais linhas pertencem à mesma série, então não gera nada até a coluna existir
  // (gerar errado aqui criaria duplicatas).
  if (linhas.some((c) => !c.serie_id)) return []

  const ordenadas = [...linhas].sort((a, b) => a.competencia.localeCompare(b.competencia))
  const porSerie = new Map<string, CompromissoFinanceiro>()
  for (const c of ordenadas) {
    porSerie.set(c.serie_id, c) // fica com a de maior competência
  }

  const novos: NovoCompromisso[] = []
  for (const ultima of porSerie.values()) {
    if (ultima.competencia >= competencia) continue

    let template = ultima
    let comp = proximaCompetencia(template.competencia)
    while (comp <= competencia) {
      const novo = {
        user_id: userId,
        categoria_id: template.categoria_id,
        nome: template.nome,
        valor: template.valor,
        vencimento: diaDoMesClamped(template.vencimento, comp),
        competencia: comp,
        recorrencia: "recorrente" as const,
        essencial: template.essencial,
        serie_id: template.serie_id,
        status: "pendente" as Status,
      }
      novos.push(novo)
      template = { ...template, ...novo }
      comp = proximaCompetencia(comp)
    }
  }
  return novos
}
