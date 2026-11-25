import { AlertCircleIcon, CheckCircle2Icon, InfoIcon, TriangleAlertIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@ritorno/ui/components/alert"
import { cn } from "cn"

const TONES = {
  info: { icon: InfoIcon, className: "border-s-4 border-s-primary", role: "status" },
  success: { icon: CheckCircle2Icon, className: "border-s-4 border-s-primary", role: "status" },
  warning: { icon: TriangleAlertIcon, className: "border-s-4 border-s-foreground", role: "status" },
  error: { icon: AlertCircleIcon, className: "border-s-4 border-s-destructive", role: "alert" },
} as const

type InlineAlertProps = {
  tone?: keyof typeof TONES
  title?: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

function InlineAlert({ tone = "info", title, children, action, className }: InlineAlertProps) {
  const { icon: Icon, className: toneClass, role } = TONES[tone]
  return (
    <Alert
      role={role}
      variant={tone === "error" ? "destructive" : "default"}
      className={cn("px-3 py-3", toneClass, className)}
    >
      <Icon aria-hidden />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {children ? <AlertDescription className={cn(!title && "row-span-2")}>{children}</AlertDescription> : null}
      {action ? <div className="col-start-2 mt-2 flex gap-2">{action}</div> : null}
    </Alert>
  )
}

export { InlineAlert }
