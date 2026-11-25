import type { ReactNode } from "react"

export const CONTAINER = "mx-auto w-full max-w-6xl px-5 md:px-8"

export function Section({
  id,
  title,
  subtitle,
  badge,
  children,
}: {
  id?: string
  title: string
  subtitle?: string
  badge?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-16 border-t bg-background">
      <div className={`${CONTAINER} py-16 md:py-24`}>
        <div className="grid max-w-2xl gap-3">
          {badge ? <p className="w-fit rounded-full border bg-muted px-3 py-1 font-medium text-xs">{badge}</p> : null}
          <h2 className="text-balance font-semibold text-h2 tracking-tight">{title}</h2>
          {subtitle ? <p className="text-muted-foreground leading-relaxed">{subtitle}</p> : null}
        </div>
        <div className="mt-10 md:mt-14">{children}</div>
      </div>
    </section>
  )
}
