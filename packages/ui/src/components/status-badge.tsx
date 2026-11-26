import { cn } from "cn"
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon, TriangleAlertIcon } from "lucide-react"

const STATUS_TONES = {
  success: { className: "bg-success-soft text-success", icon: CheckCircle2Icon },
  warning: { className: "bg-warning-soft text-warning", icon: TriangleAlertIcon },
  danger: { className: "bg-destructive-soft text-destructive", icon: AlertCircleIcon },
  info: { className: "bg-info-soft text-info", icon: InfoIcon },
  neutral: { className: "bg-surface text-muted-foreground", icon: null },
} as const

type StatusTone = keyof typeof STATUS_TONES

type StatusBadgeProps = {
  tone?: StatusTone
  /** Replaces the tone icon. `null` hides it. The text must carry the meaning, color never does alone. */
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}

function StatusBadge({ tone = "neutral", icon, children, className }: StatusBadgeProps) {
  const { className: toneClass, icon: ToneIcon } = STATUS_TONES[tone]
  const shown = icon === undefined ? ToneIcon ? <ToneIcon /> : null : icon
  return (
    <span
      data-slot="status-badge"
      data-tone={tone}
      className={cn(
        "inline-flex h-7 w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 font-medium text-xs [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
        toneClass,
        className,
      )}
    >
      {shown ? <span aria-hidden className="contents">{shown}</span> : null}
      {children}
    </span>
  )
}

export { STATUS_TONES, StatusBadge, type StatusTone }
