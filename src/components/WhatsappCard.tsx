import { useEffect, useState } from "react"
import { toast } from "sonner"
import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { useDesconectarWhatsapp, useGerarCodigoWhatsapp, useVinculoWhatsapp } from "@/hooks/useWhatsapp"

/** Número do bot (só dígitos, com DDI), para o link que abre a conversa já com o código. */
const NUMERO_BOT = import.meta.env.VITE_WHATSAPP_NUMERO?.replace(/\D/g, "")

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

export function WhatsappCard() {
  const [codigo, setCodigo] = useState<{ codigo: string; expira_em: string } | null>(null)
  const { data: vinculo, isLoading } = useVinculoWhatsapp(!!codigo)
  const gerar = useGerarCodigoWhatsapp()
  const desconectar = useDesconectarWhatsapp()

  // O bot fez a ligação enquanto o código estava na tela.
  useEffect(() => {
    if (codigo && vinculo) {
      setCodigo(null)
      toast.success("WhatsApp conectado")
    }
  }, [codigo, vinculo])

  async function onGerar() {
    try {
      setCodigo(await gerar.mutateAsync())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar o código")
    }
  }

  async function onDesconectar() {
    try {
      await desconectar.mutateAsync()
      toast.success("WhatsApp desconectado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desconectar")
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="size-4" />
          WhatsApp
        </CardTitle>
        <CardDescription>
          Lance gastos e consulte faturas mandando mensagem para o bot do Tudo em dia
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : vinculo ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Conectado ao número <span className="font-mono">+{vinculo.telefone}</span>
            </p>
            <ConfirmDialog
              trigger={<Button variant="outline" disabled={desconectar.isPending}>Desconectar</Button>}
              title="Desconectar o WhatsApp?"
              description="O bot deixa de responder a este número. Seus lançamentos continuam no app."
              confirmLabel="Desconectar"
              onConfirm={onDesconectar}
            />
          </div>
        ) : codigo ? (
          <div className="space-y-3">
            <p className="text-sm">
              Mande este código para o bot{NUMERO_BOT ? <> no número <span className="font-mono">+{NUMERO_BOT}</span></> : null}:
            </p>
            <p className="font-mono text-3xl tracking-[0.3em]">{codigo.codigo}</p>
            <p className="text-xs text-muted-foreground">
              Vale até {horaLocal(codigo.expira_em)}. Esta tela atualiza sozinha quando o bot confirmar.
            </p>
            <div className="flex flex-wrap gap-2">
              {NUMERO_BOT && (
                <Button asChild>
                  <a href={`https://wa.me/${NUMERO_BOT}?text=${codigo.codigo}`} target="_blank" rel="noreferrer">
                    Abrir no WhatsApp
                  </a>
                </Button>
              )}
              <Button variant="outline" onClick={onGerar} disabled={gerar.isPending}>
                Gerar outro código
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Gere um código e mande para o bot pelo WhatsApp: é assim que ele sabe que o número é seu.
            </p>
            <Button onClick={onGerar} disabled={gerar.isPending}>
              Conectar WhatsApp
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
