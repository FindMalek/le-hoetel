import { ZelligePattern } from "@le-hoetel/ui/components/zellige-pattern"
import { BrandMark } from "@/components/brand-mark"

export function ErrorScreen({
  code,
  title,
  body,
  children,
}: {
  code: string
  title: string
  body: string
  children: React.ReactNode
}) {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden px-4 py-12 text-center">
      <div aria-hidden className="-z-10 absolute inset-0 mask-fade-center">
        <ZelligePattern />
      </div>
      <div className="flex max-w-md flex-col items-center gap-6">
        <BrandMark />
        <p className="font-heading font-semibold text-muted-foreground text-sm tabular-nums tracking-widest">{code}</p>
        <div className="flex flex-col gap-2">
          <h1 className="text-balance font-heading font-semibold text-3xl tracking-tight">{title}</h1>
          <p className="text-pretty text-muted-foreground">{body}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>
      </div>
    </main>
  )
}
