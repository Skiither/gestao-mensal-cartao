import type { Moeda } from "@/types/database"

const LOCALE_POR_MOEDA: Record<Moeda, string> = {
  EUR: "pt-PT",
  BRL: "pt-BR",
}

export function formatarMoeda(valor: number, moeda: Moeda = "EUR"): string {
  return valor.toLocaleString(LOCALE_POR_MOEDA[moeda], { style: "currency", currency: moeda })
}

export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split("-")
  return `${dia}/${mes}/${ano}`
}
