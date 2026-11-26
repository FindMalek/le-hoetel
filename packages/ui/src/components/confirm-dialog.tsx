"use client"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ritorno/ui/components/alert-dialog"
import { Button } from "@ritorno/ui/components/button"
import { FormField } from "@ritorno/ui/components/form-field"
import { Input } from "@ritorno/ui/components/input"
import { useState } from "react"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description: React.ReactNode
  confirmLabel: React.ReactNode
  cancelLabel: React.ReactNode
  onConfirm: () => void
  destructive?: boolean
  pending?: boolean
  confirmDisabled?: boolean
  /** Asks to type `expected` (a slug, a name, case and outer spaces ignored) before the confirm button works. */
  typedConfirmation?: { label: React.ReactNode; expected: string }
  /** Extra content between the text and the buttons. */
  children?: React.ReactNode
}

const normalize = (value: string): string => value.trim().toLowerCase()

/** Lives inside the popup, which unmounts on close, so the typed text never survives a reopen. */
function ConfirmBody({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive,
  pending,
  confirmDisabled,
  typedConfirmation,
  children,
}: Omit<ConfirmDialogProps, "open" | "onOpenChange">) {
  const [typed, setTyped] = useState("")
  const mismatch = typedConfirmation ? normalize(typed) !== normalize(typedConfirmation.expected) : false
  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      {typedConfirmation ? (
        <FormField label={typedConfirmation.label}>
          {(aria) => (
            <Input
              {...aria}
              value={typed}
              dir="auto"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => setTyped(event.target.value)}
            />
          )}
        </FormField>
      ) : null}
      {children}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
        <Button
          variant={destructive ? "destructive" : "default"}
          loading={pending}
          disabled={confirmDisabled || mismatch}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </AlertDialogFooter>
    </>
  )
}

function ConfirmDialog({ open, onOpenChange, ...body }: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <ConfirmBody {...body} />
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ConfirmDialog }
