import { cn } from "@le-hoetel/ui/lib/utils"
import { logoSrc } from "@/lib/admin"

/** The hotel's logo, or its first letter on the hotel's own primary color when it has none. */
export function HotelAvatar({
  name,
  logoKey,
  className,
}: {
  name: string
  logoKey: string | null
  className?: string
}) {
  const src = logoSrc(logoKey)
  return src ? (
    // biome-ignore lint/performance/noImgElement: the logo is a small file served by the api
    <img src={src} alt="" className={cn("size-10 shrink-0 rounded-lg border bg-background object-contain p-0.5", className)} />
  ) : (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-lg bg-muted font-heading font-semibold text-muted-foreground",
        className,
      )}
    >
      {name.trim().slice(0, 1).toUpperCase()}
    </span>
  )
}
