"use client"

import { Button } from "@ritorno/ui/components/button"
import { useFormStatus } from "react-dom"

/** The submit of a plain server form: disabled with a spinner while the action runs, so a double tap cannot send twice. */
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" loading={pending} className="w-full">
      {children}
    </Button>
  )
}
