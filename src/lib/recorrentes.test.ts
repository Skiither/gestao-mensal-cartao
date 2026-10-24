import { describe, expect, it } from "vitest"
import { recorrentesFaltando } from "./recorrentes"
import type { CompromissoFinanceiro } from "../types/database"

function linha(parcial: Partial<CompromissoFinanceiro>): CompromissoFinanceiro {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    categoria_id: null,
    nome: "Aluguel",
    valor: 1000,
    vencimento: "2026-08-15",
    competencia: "2026-08",
    recorrencia: "recorrente",
    essencial: true,
    status: "pago",
    serie_id: "s1",
    created_at: "",
    ...parcial,
  }
}

describe("recorrentesFaltando", () => {
  it("gera os meses que faltam a partir da última linha da série, pendentes", () => {
    const novos = recorrentesFaltando([linha({})], "u1", "2026-10")
    expect(novos.map((n) => [n.competencia, n.vencimento, n.status])).toEqual([
      ["2026-09", "2026-09-15", "pendente"],
      ["2026-10", "2026-10-15", "pendente"],
    ])
  })

  it("parte da linha mais recente mesmo que venham fora de ordem", () => {
    const linhas = [linha({ competencia: "2026-10", vencimento: "2026-10-05", valor: 1200 }), linha({})]
    const novos = recorrentesFaltando(linhas, "u1", "2026-11")
    expect(novos).toHaveLength(1)
    expect(novos[0]).toMatchObject({ competencia: "2026-11", valor: 1200 })
  })

  it("não gera nada se alguma linha não tiver serie_id", () => {
    expect(recorrentesFaltando([linha({ serie_id: "" })], "u1", "2026-10")).toEqual([])
  })
})
