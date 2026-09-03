import type { Moeda } from "@/types/database"

// Locale pt-BR nas duas moedas: coloca o símbolo antes do valor ("€ 1.186,00"),
// como na proposta visual aprovada.
const LOCALE_POR_MOEDA: Record<Moeda, string> = {
  EUR: "pt-BR",
  BRL: "pt-BR",
}

export function formatarMoeda(valor: number, moeda: Moeda = "EUR"): string {
  return valor.toLocaleString(LOCALE_POR_MOEDA[moeda], { style: "currency", currency: moeda })
}

export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-")
  return `${dia}/${mes}/${ano}`
}
