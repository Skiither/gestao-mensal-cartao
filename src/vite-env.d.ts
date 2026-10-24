/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Número do bot de WhatsApp (com DDI). Opcional: sem ele a tela não mostra o link. */
  readonly VITE_WHATSAPP_NUMERO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
