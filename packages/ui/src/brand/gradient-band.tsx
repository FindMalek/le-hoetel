import { cn } from "@ritorno/ui/lib/utils"

/** Blurred sky band for the very bottom of the page, CSS only. */
export function GradientBand({ className }: { className?: string }) {
  return (
    <div aria-hidden data-slot="gradient-band" className={cn("relative h-30 overflow-hidden", className)}>
      <div
        className="absolute -inset-x-[10%] -bottom-1/2 top-1/4 blur-2xl"
        style={{
          background: [
            "radial-gradient(40% 70% at 18% 70%, var(--blue-300), transparent 70%)",
            "radial-gradient(35% 80% at 52% 85%, var(--blue-500), transparent 70%)",
            "radial-gradient(30% 60% at 70% 45%, var(--blue-100), transparent 70%)",
            "radial-gradient(40% 80% at 88% 80%, var(--blue-400), transparent 70%)",
          ].join(", "),
        }}
      />
    </div>
  )
}
