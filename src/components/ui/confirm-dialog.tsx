"use client"

import type { ReactNode } from "react"
import { AlertDialog } from "@base-ui/react/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** Botão extra (ex.: "Só esconder") entre confirmar e cancelar. */
  extraAction?: { label: string; onClick: () => void }
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
}

/** Confirmação acessível (foco preso, Esc fecha) para ações sem volta. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  extraAction,
  destructive,
  pending,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-choc-deep/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-choc bg-cream p-5 text-choc-deep shadow-xl transition duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
          <AlertDialog.Title className="font-display text-2xl leading-tight font-black text-choc">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-base leading-snug text-choc-muted">
            {description}
          </AlertDialog.Description>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              size="lg"
              disabled={pending}
              onClick={onConfirm}
              className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90")}
            >
              {pending ? "Aguarde..." : confirmLabel}
            </Button>
            {extraAction && (
              <Button size="lg" variant="secondary" disabled={pending} onClick={extraAction.onClick}>
                {extraAction.label}
              </Button>
            )}
            <AlertDialog.Close render={<Button size="lg" variant="outline" disabled={pending} />}>
              {cancelLabel}
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
