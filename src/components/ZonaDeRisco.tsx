import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useResetarDadosFinanceiros } from "@/hooks/useResetarConta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"

export function ZonaDeRisco() {
  const { user, signIn, reabrirOnboarding } = useAuth()
  const resetarMutation = useResetarDadosFinanceiros()
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [etapa, setEtapa] = useState<"senha" | "confirmar">("senha")
  const [senha, setSenha] = useState("")
  const [verificando, setVerificando] = useState(false)

  function abrir() {
    setEtapa("senha")
    setSenha("")
    setOpen(true)
  }

  async function confirmarSenha() {
    if (!user?.email) return
    setVerificando(true)
    const { error } = await signIn(user.email, senha)
    setVerificando(false)
    if (error) {
      toast.error("Senha incorreta")
      return
    }
    setEtapa("confirmar")
  }

  async function executarReset() {
    try {
      await resetarMutation.mutateAsync()
      await reabrirOnboarding()
      setOpen(false)
      toast.success("Seus dados financeiros foram apagados")
      navigate("/onboarding", { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao resetar os dados")
    }
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="size-4" /> Zona de risco
        </CardTitle>
        <CardDescription>
          Apaga todos os seus compromissos, cartões, categorias, receitas, metas e patrimônio.
          Sua conta de login continua existindo, mas os dados não podem ser recuperados depois disso.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={abrir}>
          Resetar dados financeiros
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            {etapa === "senha" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Confirme sua senha</DialogTitle>
                  <DialogDescription>
                    Por segurança, digite sua senha atual para continuar.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  type="password"
                  placeholder="Sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={confirmarSenha} disabled={verificando || senha.length === 0}>
                    {verificando ? "Verificando..." : "Continuar"}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="text-destructive">Tem certeza?</DialogTitle>
                  <DialogDescription>
                    Isso vai apagar permanentemente todos os seus compromissos, cartões, categorias,
                    receitas, metas e patrimônio. Essa ação não pode ser desfeita.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button
                    variant="destructive"
                    onClick={executarReset}
                    disabled={resetarMutation.isPending}
                  >
                    {resetarMutation.isPending ? "Apagando..." : "Sim, apagar tudo"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
