import { cloneElement, useState, type MouseEvent, type ReactElement } from "react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ConfirmDialogProps {
  /** Elemento clicável único. Estado controlado à parte (não via AlertDialogTrigger) porque o
   *  Radix cancela a abertura quando o onClick do próprio trigger já chamou preventDefault
   *  (necessário, por exemplo, quando o botão fica dentro de um Link). */
  trigger: ReactElement<{ onClick?: (e: MouseEvent) => void }>
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
}

/** Confirmação antes de uma ação destrutiva (excluir). */
export function ConfirmDialog({ trigger, title, description, confirmLabel = "Excluir", onConfirm }: ConfirmDialogProps) {
  const [open, setOpen] = useState(false)

  const triggerComEstado = cloneElement(trigger, {
    onClick: (e: MouseEvent) => {
      trigger.props.onClick?.(e)
      setOpen(true)
    },
  })

  return (
    <>
      {triggerComEstado}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
