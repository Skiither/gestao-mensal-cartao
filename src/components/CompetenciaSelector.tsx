import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCompetencia } from "@/contexts/CompetenciaContext"
import { competenciaAdjacente, formatarCompetencia } from "@/lib/competencia"

export function CompetenciaSelector() {
  const { competencia, setCompetencia } = useCompetencia()

  return (
    <div className="flex items-center gap-1 rounded-md border bg-background px-1 py-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => setCompetencia(competenciaAdjacente(competencia, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-20 text-center text-sm font-medium capitalize sm:min-w-28">
        {formatarCompetencia(competencia)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => setCompetencia(competenciaAdjacente(competencia, 1))}
        aria-label="Próximo mês"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
