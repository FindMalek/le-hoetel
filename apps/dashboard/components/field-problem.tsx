import { FieldError } from "@ritorno/ui/components/field"
import { AlertCircleIcon } from "lucide-react"

export function FieldProblem({ id, children }: { id: string; children?: React.ReactNode }) {
  if (!children) return null
  return (
    <FieldError id={id} className="flex items-start gap-1.5">
      <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </FieldError>
  )
}
