import { cn } from "@ritorno/ui/lib/utils"
import { Children, type ComponentProps, type ReactNode } from "react"

const REVEAL_BUDGET_MS = 200
const STAGGER_MS = 60

export interface DisplayProps extends ComponentProps<"h1"> {
  as?: "h1" | "h2" | "h3" | "p"
  size?: "xl" | "default"
  /** Words rise and unblur in turn, done by 600ms. The global reduced motion rule renders them in place. */
  reveal?: boolean
}

function words(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    typeof child === "string" ? child.split(/(\s+)/).filter(Boolean) : [child],
  )
}

/** Serif display line: Newsreader italic in en and fr, upright Noto Naskh Arabic in ar. Wrap the emphasis word in <em>. */
export function Display({
  as: Tag = "h1",
  size = "default",
  reveal = false,
  className,
  children,
  ...props
}: DisplayProps) {
  const parts = reveal ? words(children) : []
  const count = parts.filter((part) => typeof part !== "string" || part.trim()).length
  const step = Math.min(STAGGER_MS, REVEAL_BUDGET_MS / Math.max(count - 1, 1))
  let index = 0
  return (
    <Tag
      data-slot="display"
      className={cn(
        "font-display text-balance text-foreground [&_em]:text-blue-600",
        size === "xl" ? "text-display-xl" : "text-display",
        className,
      )}
      {...props}
    >
      {reveal
        ? parts.map((part, i) => {
            if (typeof part === "string" && !part.trim()) return part
            const delay = `${Math.round(index++ * step)}ms`
            return (
              <span key={i} className="animate-word-rise" style={{ animationDelay: delay }}>
                {part}
              </span>
            )
          })
        : children}
    </Tag>
  )
}
