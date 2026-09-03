import { Link } from "react-router-dom"
import { useTheme } from "next-themes"
import { Settings } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { ZonaDeRisco } from "@/components/ZonaDeRisco"

function iniciais(nome: string, email: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

export function PerfilPage() {
  const { user, nomeCompleto } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const escuro = resolvedTheme === "dark"
  const email = user?.email ?? ""

  return (
    <div className="max-w-[34rem] space-y-4">
      <h1 className="font-heading text-[clamp(1.9rem,4vw,2.6rem)] font-normal leading-[1.05] tracking-tight">Perfil</h1>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="text-lg font-medium">
                {iniciais(nomeCompleto, email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">
                {nomeCompleto || "Sem nome"}
              </p>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
            </div>
          </div>

          <Separator className="my-5" />

          <dl className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Nome completo</dt>
              <dd className="truncate text-sm font-medium">{nomeCompleto || "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">E-mail usado</dt>
              <dd className="truncate text-sm font-medium">{email}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Tema escuro</dt>
              <dd className="flex items-center">
                <Switch
                  checked={escuro}
                  onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
                  aria-label="Alternar entre tema claro e escuro"
                />
              </dd>
            </div>
          </dl>

          <Separator className="my-5" />

          <Button variant="outline" className="w-full" asChild>
            <Link to="/configuracoes">
              <Settings className="size-4" />
              Configurações
            </Link>
          </Button>
        </CardContent>
      </Card>

      <ZonaDeRisco />
    </div>
  )
}
