// Detalhes da WhatsApp Cloud API: conferir que o webhook veio mesmo da Meta, extrair as
// mensagens do payload e mandar respostas.
import { createHmac, timingSafeEqual } from "node:crypto"

const VERSAO_GRAPH = "v23.0"

/** Confere o cabeçalho X-Hub-Signature-256 (HMAC-SHA256 do corpo cru com o App Secret). */
export function assinaturaValida(corpo: string, cabecalho: string | null, segredo: string): boolean {
  if (!cabecalho?.startsWith("sha256=")) return false
  const esperado = Buffer.from(createHmac("sha256", segredo).update(corpo, "utf8").digest("hex"))
  const recebido = Buffer.from(cabecalho.slice("sha256=".length))
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
}

export interface MensagemRecebida {
  id: string
  /** Número de quem mandou, só dígitos com DDI (o "wa_id" do WhatsApp). */
  de: string
  /** Texto da mensagem; null para áudio, foto, figurinha etc. */
  texto: string | null
}

interface PayloadWebhook {
  entry?: {
    changes?: {
      value?: {
        messages?: { id: string; from: string; type: string; text?: { body?: string } }[]
      }
    }[]
  }[]
}

/** Mensagens novas do payload. Avisos de entrega/leitura (statuses) são ignorados. */
export function extrairMensagens(payload: PayloadWebhook): MensagemRecebida[] {
  const mensagens: MensagemRecebida[] = []
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        mensagens.push({ id: m.id, de: m.from, texto: m.type === "text" ? m.text?.body ?? "" : null })
      }
    }
  }
  return mensagens
}

export async function enviarTexto(para: string, texto: string, cfg: { token: string; phoneNumberId: string }) {
  const res = await fetch(`https://graph.facebook.com/${VERSAO_GRAPH}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto } }),
  })
  if (!res.ok) throw new Error(`WhatsApp respondeu ${res.status}: ${await res.text()}`)
}

const FUSO_POR_DDI: [string, string][] = [
  ["351", "Europe/Lisbon"],
  ["55", "America/Sao_Paulo"],
]

/** Fuso horário pelo DDI do número; o padrão vale para os DDIs não listados. */
export function fusoDoTelefone(telefone: string, padrao: string): string {
  return FUSO_POR_DDI.find(([ddi]) => telefone.startsWith(ddi))?.[1] ?? padrao
}

/** 'YYYY-MM-DD' de `agora` no fuso dado. */
export function dataNoFuso(agora: Date, fuso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora)
}
