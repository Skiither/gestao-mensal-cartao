import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/** Página pública exigida pela Meta para publicar o app do bot de WhatsApp. */
export function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <h1 className="font-heading text-[clamp(1.9rem,4vw,2.6rem)] font-normal leading-[1.05] tracking-tight">
        Política de Privacidade
      </h1>
      <p className="text-sm text-muted-foreground">Tudo em dia · atualizada em novembro de 2026</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que guardamos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            O Tudo em dia guarda os dados que você mesmo cadastra para planejar o seu mês: receitas, contas,
            cartões, compras parceladas, categorias, metas e patrimônio, além do seu nome e e-mail de acesso.
          </p>
          <p>
            Se você conectar o WhatsApp, guardamos também o seu número de telefone e as mensagens necessárias
            para fazer os lançamentos e responder às suas perguntas (por exemplo, em que etapa de um
            lançamento a conversa parou). Não guardamos o histórico das conversas.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como usamos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Os dados servem só para mostrar e calcular as suas finanças dentro do app e no bot do WhatsApp.
            Cada conta só enxerga os próprios dados. Não vendemos, não compartilhamos com anunciantes e não
            usamos os seus dados para publicidade.
          </p>
          <p>
            As mensagens do WhatsApp passam pela plataforma WhatsApp Business da Meta, que as entrega ao
            nosso servidor. Os dados ficam armazenados no Supabase e o app é hospedado na Vercel.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como apagar os seus dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Em <strong>Configurações → WhatsApp</strong> você desconecta o número a qualquer momento, e o bot
            deixa de responder a ele. Em <strong>Perfil → Zona de risco</strong> você apaga todos os seus
            dados financeiros.
          </p>
        </CardContent>
      </Card>

      <p className="text-sm">
        <Link to="/" className="underline underline-offset-4">
          Voltar ao app
        </Link>
      </p>
    </div>
  )
}
