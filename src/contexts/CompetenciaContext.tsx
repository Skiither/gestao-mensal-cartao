import { createContext, useContext, useState, type ReactNode } from "react"
import { competenciaAtual, type Competencia } from "@/lib/competencia"

interface CompetenciaContextValue {
  competencia: Competencia
  setCompetencia: (competencia: Competencia) => void
}

const CompetenciaContext = createContext<CompetenciaContextValue | undefined>(undefined)

export function CompetenciaProvider({ children }: { children: ReactNode }) {
  const [competencia, setCompetencia] = useState<Competencia>(competenciaAtual())

  return (
    <CompetenciaContext.Provider value={{ competencia, setCompetencia }}>
      {children}
    </CompetenciaContext.Provider>
  )
}

export function useCompetencia() {
  const ctx = useContext(CompetenciaContext)
  if (!ctx) throw new Error("useCompetencia deve ser usado dentro de <CompetenciaProvider>")
  return ctx
}
