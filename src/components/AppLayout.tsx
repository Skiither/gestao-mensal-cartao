import { Navigate, NavLink, Outlet } from "react-router-dom"
import {
  LayoutDashboard, Wallet, Receipt, CreditCard, Tags, Target, PiggyBank, LogOut, Menu, UserRound,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CompetenciaSelector } from "@/components/CompetenciaSelector"
import { useAuth } from "@/contexts/AuthContext"

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/receitas", label: "Receitas", icon: Wallet },
  { to: "/compromissos", label: "Compromissos", icon: Receipt },
  { to: "/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/categorias", label: "Categorias", icon: Tags },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/patrimonio", label: "Patrimônio", icon: PiggyBank },
  { to: "/perfil", label: "Perfil", icon: UserRound },
]

export function AppLayout() {
  const { user, nomeCompleto, signOut, onboardingCompleto } = useAuth()

  if (!onboardingCompleto) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="min-h-svh bg-muted/20">
      {/* Menu lateral fixo — só no desktop */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r bg-background lg:flex">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-4" />
          </div>
          <span className="font-semibold">Tudo em dia</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-3">
          <div className="mb-2 truncate px-2 text-sm text-muted-foreground">
            {nomeCompleto || user?.email}
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Cabeçalho no mobile/tablet — menu vira dropdown */}
      <header className="sticky top-0 z-10 border-b bg-background lg:hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Abrir menu">
                  <Menu className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                  <DropdownMenuItem key={to} asChild>
                    <NavLink
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2",
                          isActive && "bg-accent text-accent-foreground"
                        )
                      }
                    >
                      <Icon className="size-4" />
                      {label}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-4" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CompetenciaSelector />
            <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Sair">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Barra do mês — fica no topo do conteúdo no desktop */}
      <div className="sticky top-0 z-10 hidden border-b bg-background lg:block lg:pl-60">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <CompetenciaSelector />
        </div>
      </div>

      <main className="px-4 py-6 lg:pl-60">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
