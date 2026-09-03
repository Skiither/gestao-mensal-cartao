import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCompetencia } from "@/contexts/CompetenciaContext"
import {
  competenciaAdjacente,
  competenciaAtual,
  formatarCompetencia,
  formatarCompetenciaCurta,
  MESES_CURTOS,
  montarCompetencia,
  partesCompetencia,
} from "@/lib/competencia"
import { cn } from "@/lib/utils"

export function CompetenciaSelector() {
  const { competencia, setCompetencia } = useCompetencia()
  const [open, setOpen] = useState(false)
  const selecionada = partesCompetencia(competencia)
  const hoje = partesCompetencia(competenciaAtual())
  const [anoView, setAnoView] = useState(selecionada.ano)

  function abrir(novoOpen: boolean) {
    if (novoOpen) setAnoView(selecionada.ano)
    setOpen(novoOpen)
  }

  function escolherMes(mes: number) {
    setCompetencia(montarCompetencia(anoView, mes))
    setOpen(false)
  }

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

      <Popover open={open} onOpenChange={abrir}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="h-7 min-w-0 px-1.5 text-sm font-medium capitalize sm:min-w-28 sm:px-2"
            aria-label="Escolher mês e ano"
          >
            <span className="sm:hidden">{formatarCompetenciaCurta(competencia)}</span>
            <span className="hidden sm:inline">{formatarCompetencia(competencia)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-64">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setAnoView((a) => a - 1)}
              aria-label="Ano anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold">{anoView}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setAnoView((a) => a + 1)}
              aria-label="Próximo ano"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {MESES_CURTOS.map((nome, i) => {
              const mes = i + 1
              const atual = anoView === selecionada.ano && mes === selecionada.mes
              const ehHoje = anoView === hoje.ano && mes === hoje.mes
              return (
                <Button
                  key={nome}
                  variant={atual ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8",
                    !atual && ehHoje && "ring-1 ring-primary/40"
                  )}
                  onClick={() => escolherMes(mes)}
                >
                  {nome}
                </Button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

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
