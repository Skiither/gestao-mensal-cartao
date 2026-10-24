import { describe, expect, it } from "vitest"
import {
  ESTADO_INICIAL,
  lerMes,
  lerValor,
  mesDaFatura,
  responder,
  type Contexto,
  type DadosDoUsuario,
  type Estado,
  type ResumoMes,
} from "./conversa"

const ctx: Contexto = { hoje: "2026-10-24", moeda: "BRL" }

function dadosFalsos(resumo: Partial<ResumoMes> = {}) {
  const lancados: { tipo: string; dados: unknown }[] = []
  const dados: DadosDoUsuario = {
    cartoes: async () => [
      { id: "nu", nome: "Nubank", dia_fechamento: 3, dia_vencimento: 10 },
      { id: "in", nome: "Inter", dia_fechamento: 28, dia_vencimento: 5 },
    ],
    categorias: async () => [
      { id: "mor", nome: "Moradia" },
      { id: "laz", nome: "Lazer" },
    ],
    resumoDoMes: async () => ({ receitas: 0, compromissos: [], parcelas: [], ...resumo }),
    pendenteTotalPorCartao: async () => new Map([["nu", 500]]),
    lancarCompraCartao: async (i) => { lancados.push({ tipo: "compra", dados: i }) },
    lancarConta: async (i) => { lancados.push({ tipo: "conta", dados: i }) },
    lancarReceita: async (i) => { lancados.push({ tipo: "receita", dados: i }) },
  }
  return { dados, lancados }
}

/** Manda as mensagens em sequência e devolve o último resultado. */
async function conversar(dados: DadosDoUsuario, mensagens: string[], estado: Estado = ESTADO_INICIAL) {
  let atual = estado
  let resposta = ""
  for (const m of mensagens) {
    const r = await responder(atual, m, ctx, dados)
    atual = r.estado
    // Intl separa o símbolo da moeda com espaço não separável
    resposta = r.resposta.replace(/ /g, " ")
  }
  return { estado: atual, resposta }
}

describe("lerValor", () => {
  it.each([
    ["45 mercado", 45, "mercado"],
    ["45,90 mercado", 45.9, "mercado"],
    ["mercado 45.90", 45.9, "mercado"],
    ["R$ 1.234,56 aluguel", 1234.56, "aluguel"],
    ["1.234 notebook", 1234, "notebook"],
    ["€12 café", 12, "café"],
    ["paguei 120 de luz", 120, "paguei de luz"],
    ["300", 300, ""],
  ])("%s", (texto, valor, resto) => {
    expect(lerValor(texto)).toEqual({ valor, resto })
  })

  it("não acha valor em texto sem número", () => {
    expect(lerValor("oi tudo bem")).toBeNull()
  })
})

describe("lerMes", () => {
  it("mês sem ano pega o próximo daquele mês", () => {
    expect(lerMes("12", "2026-10-24")).toBe("2026-12")
    expect(lerMes("2", "2026-10-24")).toBe("2027-02")
    expect(lerMes("10", "2026-10-24")).toBe("2026-10")
  })

  it("aceita ano e nome do mês", () => {
    expect(lerMes("3/2027", "2026-10-24")).toBe("2027-03")
    expect(lerMes("03/27", "2026-10-24")).toBe("2027-03")
    expect(lerMes("dezembro", "2026-10-24")).toBe("2026-12")
    expect(lerMes("jan 2027", "2026-10-24")).toBe("2027-01")
  })

  it("recusa mês inválido", () => {
    expect(lerMes("13", "2026-10-24")).toBeNull()
    expect(lerMes("amanhã", "2026-10-24")).toBeNull()
  })
})

describe("mesDaFatura", () => {
  const nubank = { dia_fechamento: 3, dia_vencimento: 10 }
  const inter = { dia_fechamento: 28, dia_vencimento: 5 }

  it("compra até o fechamento vai para a fatura que fecha neste mês", () => {
    expect(mesDaFatura(nubank, "2026-10-02")).toBe("2026-10")
    expect(mesDaFatura(nubank, "2026-10-03")).toBe("2026-10")
  })

  it("compra depois do fechamento vai para a próxima", () => {
    expect(mesDaFatura(nubank, "2026-10-24")).toBe("2026-11")
  })

  it("quando vence no mês seguinte ao fechamento, conta no mês do vencimento", () => {
    expect(mesDaFatura(inter, "2026-10-24")).toBe("2026-11")
    expect(mesDaFatura(inter, "2026-10-29")).toBe("2026-12")
    expect(mesDaFatura(inter, "2026-12-29")).toBe("2027-02")
  })
})

describe("lançar no cartão", () => {
  it("pergunta tipo, cartão, parcelas e mês, e lança a compra", async () => {
    const { dados, lancados } = dadosFalsos()
    const { estado, resposta } = await conversar(dados, ["45 mercado", "1", "1", "3", "sim"])
    expect(lancados).toEqual([
      {
        tipo: "compra",
        dados: { cartaoId: "nu", descricao: "mercado", valorTotal: 45, parcelas: 3, mesInicial: "2026-11" },
      },
    ])
    expect(resposta).toContain("3x de R$ 15,00")
    expect(estado).toEqual(ESTADO_INICIAL)
  })

  it("aceita o nome do cartão e outro mês de fatura", async () => {
    const { dados, lancados } = dadosFalsos()
    await conversar(dados, ["200 tênis", "cartao", "inter", "à vista", "2", "12"])
    expect(lancados[0].dados).toMatchObject({ cartaoId: "in", parcelas: 1, mesInicial: "2026-12" })
  })

  it("com um cartão só, não pergunta qual", async () => {
    const { dados } = dadosFalsos()
    dados.cartoes = async () => [{ id: "nu", nome: "Nubank", dia_fechamento: 3, dia_vencimento: 10 }]
    const { estado, resposta } = await conversar(dados, ["45 mercado", "1"])
    expect(estado.etapa).toBe("parcelas")
    expect(resposta).toContain("Nubank")
  })

  it("sem cartão cadastrado, avisa e encerra", async () => {
    const { dados } = dadosFalsos()
    dados.cartoes = async () => []
    const { estado, resposta } = await conversar(dados, ["45 mercado", "1"])
    expect(estado).toEqual(ESTADO_INICIAL)
    expect(resposta).toContain("não tem cartão")
  })
})

describe("lançar conta", () => {
  it("conta mensal: categoria, dia e se já foi paga", async () => {
    const { dados, lancados } = dadosFalsos()
    const { resposta } = await conversar(dados, ["120 luz", "2", "1", "5", "2"])
    expect(lancados[0]).toEqual({
      tipo: "conta",
      dados: {
        nome: "luz",
        valor: 120,
        vencimento: "2026-10-05",
        categoriaId: "mor",
        recorrencia: "recorrente",
        pago: false,
      },
    })
    expect(resposta).toContain("vence todo dia 5")
  })

  it("conta só deste mês, sem categoria, vencendo hoje e já paga", async () => {
    const { dados, lancados } = dadosFalsos()
    await conversar(dados, ["80 presente", "3", "3", "hoje", "sim"])
    expect(lancados[0].dados).toMatchObject({
      categoriaId: null,
      recorrencia: "eventual",
      vencimento: "2026-10-24",
      pago: true,
    })
  })

  it("dia 31 em mês de 30 dias vira o último dia", async () => {
    const { dados, lancados } = dadosFalsos()
    const novembro = { ...ctx, hoje: "2026-11-10" }
    let estado = ESTADO_INICIAL
    for (const m of ["50 internet", "3", "3", "31", "2"]) estado = (await responder(estado, m, novembro, dados)).estado
    expect(lancados[0].dados).toMatchObject({ vencimento: "2026-11-30" })
  })
})

describe("lançar receita", () => {
  it("receita que se repete", async () => {
    const { dados, lancados } = dadosFalsos()
    await conversar(dados, ["3000 salário", "4", "1"])
    expect(lancados[0]).toEqual({
      tipo: "receita",
      dados: { nome: "salário", valor: 3000, data: "2026-10-24", recorrente: true },
    })
  })
})

describe("conversa", () => {
  it("valor sem descrição pergunta o que foi", async () => {
    const { dados } = dadosFalsos()
    const { estado, resposta } = await conversar(dados, ["45"])
    expect(estado.etapa).toBe("descricao")
    expect(resposta).toContain("O que foi")
    const depois = await conversar(dados, ["uber"], estado)
    expect(depois.estado.etapa).toBe("tipo")
    expect(depois.estado.rascunho?.descricao).toBe("uber")
  })

  it("resposta que não é opção repete a pergunta sem perder o rascunho", async () => {
    const { dados } = dadosFalsos()
    const antes = await conversar(dados, ["45 mercado"])
    const depois = await conversar(dados, ["9"], antes.estado)
    expect(depois.resposta).toMatch(/^Não entendi/)
    expect(depois.resposta).toContain("Cartão de crédito")
    expect(depois.estado).toEqual(antes.estado)
  })

  it("cancelar no meio não lança nada", async () => {
    const { dados, lancados } = dadosFalsos()
    const { estado, resposta } = await conversar(dados, ["45 mercado", "1", "cancelar"])
    expect(estado).toEqual(ESTADO_INICIAL)
    expect(resposta).toContain("cancelei")
    expect(lancados).toEqual([])
  })

  it("mensagem sem valor nem comando mostra a ajuda", async () => {
    const { dados } = dadosFalsos()
    const { resposta } = await conversar(dados, ["oi"])
    expect(resposta).toContain("Para lançar")
  })
})

describe("consultas", () => {
  const resumo: ResumoMes = {
    receitas: 3000,
    compromissos: [
      { nome: "Aluguel", valor: 1000, vencimento: "2026-10-05", status: "pago" },
      { nome: "Luz", valor: 120, vencimento: "2026-10-15", status: "pendente" },
    ],
    parcelas: [
      { valor: 15, status: "pendente", descricao: "mercado", numero: 2, total: 3, cartaoId: "nu", cartaoNome: "Nubank" },
      { valor: 300, status: "pendente", descricao: "tv", numero: 1, total: 1, cartaoId: "nu", cartaoNome: "Nubank" },
      { valor: 50, status: "pago", descricao: "livro", numero: 1, total: 1, cartaoId: "in", cartaoNome: "Inter" },
    ],
  }

  it("fatura soma só o que falta pagar, por cartão", async () => {
    const { dados } = dadosFalsos(resumo)
    const { resposta } = await conversar(dados, ["fatura"])
    expect(resposta).toContain("Nubank: R$ 315,00")
    expect(resposta).not.toContain("Inter")
    expect(resposta).toContain("Total: R$ 315,00")
  })

  it("fatura de um cartão lista os itens e o total em aberto", async () => {
    const { dados } = dadosFalsos(resumo)
    const { resposta } = await conversar(dados, ["fatura do nubank"])
    expect(resposta).toContain("mercado (2/3) — R$ 15,00")
    expect(resposta).toContain("Falta pagar: R$ 315,00")
    expect(resposta).toContain("próximos meses: R$ 500,00")
  })

  it("fatura de cartão que não existe lista os cartões", async () => {
    const { dados } = dadosFalsos(resumo)
    const { resposta } = await conversar(dados, ["fatura itau"])
    expect(resposta).toContain("Não achei")
    expect(resposta).toContain("• Inter")
  })

  it("contas mostra só as pendentes", async () => {
    const { dados } = dadosFalsos(resumo)
    const { resposta } = await conversar(dados, ["contas"])
    expect(resposta).toContain("15/10 Luz — R$ 120,00")
    expect(resposta).not.toContain("Aluguel")
  })

  it("sobra faz a mesma conta do Painel", async () => {
    const { dados } = dadosFalsos(resumo)
    const { resposta } = await conversar(dados, ["sobra"])
    // 3000 − (1120 de contas + 365 de cartão)
    expect(resposta).toContain("Sobra: R$ 1.515,00")
    expect(resposta).toContain("Falta pagar: R$ 435,00")
  })
})
