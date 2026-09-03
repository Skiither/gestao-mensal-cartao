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
  { to: "/", label: "Painel", icon: LayoutDashboard, end: true },
  { to: "/receitas", label: "Receitas", icon: Wallet },
  { to: "/compromissos", label: "Compromissos", icon: Receipt },
  { to: "/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/categorias", label: "Categorias", icon: Tags },
  { to: "/metas", label: "Metas", icon: Target },
  { to: "/patrimonio", label: "Património", icon: PiggyBank },
  { to: "/perfil", label: "Perfil", icon: UserRound },
]

/** Símbolo do app: a folha (mesma da maquete B). */
function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block shrink-0 leading-none select-none", className)} aria-hidden="true">
      🌿
    </span>
  )
}

/** Marca completa (folha + nome) — usada só onde há espaço. */
function Marca() {
  return (
    <span className="flex items-center gap-2 font-heading text-[1.28rem] font-medium tracking-tight">
      <Logo className="text-[1.1rem]" />
      Tudo em dia
    </span>
  )
}

export function AppLayout() {
  const { user, nomeCompleto, signOut, onboardingCompleto } = useAuth()

  if (!onboardingCompleto) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="min-h-svh bg-background">
      {/* Menu lateral fixo — só no desktop */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-7 border-r bg-sidebar px-4 py-6 lg:flex">
        <Marca />

        <nav className="flex flex-1 flex-col overflow-y-auto">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 border-l-2 py-2 pr-2 pl-3 text-[0.9rem] font-medium transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="size-4 shrink-0 opacity-80" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 pl-3 text-[0.82rem] text-muted-foreground">
          <span className="truncate">{nomeCompleto || user?.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="self-start text-muted-foreground transition-colors hover:text-foreground"
          >
            Sair
          </button>
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
            <Logo className="text-xl" />
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
        <div className="max-w-[62rem] px-10 py-1.5">
          <CompetenciaSelector />
        </div>
      </div>

      <main className="px-4 py-6 lg:py-7 lg:pr-10 lg:pb-20 lg:pl-[17.5rem]">
        <div className="max-w-[62rem]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
