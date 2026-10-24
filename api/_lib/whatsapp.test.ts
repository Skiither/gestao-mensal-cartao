import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { gerarCodigo, lerCodigo } from "../../src/lib/codigoWhatsapp"
import { assinaturaValida, dataNoFuso, extrairMensagens, fusoDoTelefone } from "./whatsapp"

describe("assinaturaValida", () => {
  const corpo = '{"entry":[]}'
  const assinatura = "sha256=" + createHmac("sha256", "segredo").update(corpo).digest("hex")

  it("aceita o corpo assinado com o App Secret", () => {
    expect(assinaturaValida(corpo, assinatura, "segredo")).toBe(true)
  })

  it("recusa corpo alterado, segredo errado ou cabeçalho ausente", () => {
    expect(assinaturaValida(corpo + " ", assinatura, "segredo")).toBe(false)
    expect(assinaturaValida(corpo, assinatura, "outro")).toBe(false)
    expect(assinaturaValida(corpo, null, "segredo")).toBe(false)
    expect(assinaturaValida(corpo, "sha256=abc", "segredo")).toBe(false)
  })
})

describe("extrairMensagens", () => {
  it("pega texto e marca outros tipos como null, ignorando avisos de entrega", () => {
    const payload = {
      entry: [{
        changes: [
          { value: { messages: [
            { id: "a", from: "5511999999999", type: "text", text: { body: "45 mercado" } },
            { id: "b", from: "5511999999999", type: "audio" },
          ] } },
          { value: {} },
        ],
      }],
    }
    expect(extrairMensagens(payload)).toEqual([
      { id: "a", de: "5511999999999", texto: "45 mercado" },
      { id: "b", de: "5511999999999", texto: null },
    ])
  })
})

describe("fuso e data", () => {
  it("escolhe o fuso pelo DDI", () => {
    expect(fusoDoTelefone("351912345678", "America/Sao_Paulo")).toBe("Europe/Lisbon")
    expect(fusoDoTelefone("5511999999999", "Europe/Lisbon")).toBe("America/Sao_Paulo")
    expect(fusoDoTelefone("14155550100", "America/Sao_Paulo")).toBe("America/Sao_Paulo")
  })

  it("no início do dia em UTC ainda é o dia anterior no Brasil", () => {
    const agora = new Date("2026-11-01T01:30:00Z")
    expect(dataNoFuso(agora, "America/Sao_Paulo")).toBe("2026-10-31")
    expect(dataNoFuso(agora, "Europe/Lisbon")).toBe("2026-11-01")
  })
})

describe("código de vínculo", () => {
  it("gera códigos que o próprio leitor aceita", () => {
    for (let i = 0; i < 50; i++) {
      const codigo = gerarCodigo()
      expect(lerCodigo(codigo)).toBe(codigo)
    }
  })

  it("aceita minúsculas e espaços, recusa letras ambíguas e tamanho errado", () => {
    expect(lerCodigo("ab3 k7m")).toBe("AB3K7M")
    expect(lerCodigo("AB3-K7M")).toBe("AB3K7M")
    expect(lerCodigo("AB3K7O")).toBeNull()
    expect(lerCodigo("AB3K7")).toBeNull()
    expect(lerCodigo("45 mercado")).toBeNull()
  })
})
