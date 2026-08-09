import { Route, Routes } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AppLayout } from "@/components/AppLayout"
import { AuthPage } from "@/pages/AuthPage"
import { RedefinirSenhaPage } from "@/pages/RedefinirSenhaPage"
import { OnboardingPage } from "@/pages/OnboardingPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { ReceitasPage } from "@/pages/ReceitasPage"
import { CompromissosPage } from "@/pages/CompromissosPage"
import { CartoesPage } from "@/pages/CartoesPage"
import { CartaoDetalhePage } from "@/pages/CartaoDetalhePage"
import { CategoriasPage } from "@/pages/CategoriasPage"
import { MetasPage } from "@/pages/MetasPage"
import { PatrimonioPage } from "@/pages/PatrimonioPage"
import { HistoricoPage } from "@/pages/HistoricoPage"
import { ConfiguracoesPage } from "@/pages/ConfiguracoesPage"

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/receitas" element={<ReceitasPage />} />
          <Route path="/compromissos" element={<CompromissosPage />} />
          <Route path="/cartoes" element={<CartoesPage />} />
          <Route path="/cartoes/:id" element={<CartaoDetalhePage />} />
          <Route path="/categorias" element={<CategoriasPage />} />
          <Route path="/metas" element={<MetasPage />} />
          <Route path="/patrimonio" element={<PatrimonioPage />} />
          <Route path="/historico" element={<HistoricoPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
