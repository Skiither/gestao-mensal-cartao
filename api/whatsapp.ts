// Webhook da WhatsApp Cloud API (função da Vercel em /api/whatsapp).
// GET: a Meta confere o webhook na configuração. POST: chegam as mensagens.
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../src/types/database.js"
import { tratarMensagem } from "./_lib/bot.js"
import { assinaturaValida, enviarTexto, extrairMensagens } from "./_lib/whatsapp.js"

function env(nome: string): string {
  const valor = process.env[nome]
  if (!valor) throw new Error(`Variável de ambiente ${nome} não configurada`)
  return valor
}

export function GET(request: Request) {
  const params = new URL(request.url).searchParams
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === env("WHATSAPP_VERIFY_TOKEN")) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 })
  }
  return new Response("Forbidden", { status: 403 })
}

export async function POST(request: Request) {
  const corpo = await request.text()
  // Sem isso qualquer um poderia mandar um POST fingindo ser o número de outra pessoa.
  if (!assinaturaValida(corpo, request.headers.get("x-hub-signature-256"), env("WHATSAPP_APP_SECRET"))) {
    return new Response("Assinatura inválida", { status: 401 })
  }

  const db = createClient<Database>(process.env.SUPABASE_URL ?? env("VITE_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const whatsapp = { token: env("WHATSAPP_TOKEN"), phoneNumberId: env("WHATSAPP_PHONE_NUMBER_ID") }

  for (const mensagem of extrairMensagens(JSON.parse(corpo))) {
    try {
      await tratarMensagem(mensagem, {
        db,
        enviar: (para, texto) => enviarTexto(para, texto, whatsapp),
        agora: new Date(),
        fusoPadrao: process.env.BOT_FUSO_HORARIO ?? "America/Sao_Paulo",
      })
    } catch (erro) {
      // Responde 200 mesmo assim: um erro aqui não se resolve com a Meta reenviando.
      console.error("Erro ao tratar mensagem", mensagem.id, erro)
    }
  }
  return new Response("ok", { status: 200 })
}
