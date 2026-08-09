import { Navigate, NavLink, Outlet } from "react-router-dom"
import {
  LayoutDashboard, Wallet, Receipt, CreditCard, Tags, Target, PiggyBank, History, LogOut, Menu, Settings,
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
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
]

export function AppLayout() {
  const { user, nomeCompleto, signOut, onboardingCompleto } = useAuth()

  if (!onboardingCompleto) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="min-h-svh bg-muted/20">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3">
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Abrir menu">
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
            <div className="hidden sm:absolute sm:left-1/2 sm:flex sm:-translate-x-1/2">
              <CompetenciaSelector />
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <span className="sm:hidden">
                <CompetenciaSelector />
              </span>
              <span className="hidden text-sm text-muted-foreground sm:mr-2 sm:inline">
                {nomeCompleto || user?.email}
              </span>
              <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Sair">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>

          <nav className="hidden gap-1 overflow-x-auto pb-1 sm:flex">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
