import { Zellige } from "./zellige"

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase()

/** The hotel's own header on every guest page: its logo (or initials) and name over a quiet pattern in its primary color. */
export function GuestHero({
  hotel,
  line,
  children,
}: {
  hotel: { displayName: string; logoUrl: string | null }
  line?: string
  children?: React.ReactNode
}) {
  return (
    <header className="relative isolate overflow-hidden border-b bg-primary/5 px-5 pt-20 pb-8">
      <Zellige className="-z-10 text-primary/20" />
      {children}
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border bg-background shadow-xs">
          {hotel.logoUrl ? (
            // biome-ignore lint/performance/noImgElement: the logo is a hotel upload served by the api, not a static asset
            <img
              src={hotel.logoUrl}
              alt=""
              width={80}
              height={80}
              decoding="async"
              className="size-full object-contain p-2"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-full items-center justify-center bg-primary font-semibold text-2xl text-primary-foreground"
            >
              {initials(hotel.displayName)}
            </span>
          )}
        </div>
        <h1 className="text-balance font-semibold text-h1 tracking-tight">{hotel.displayName}</h1>
        {line ? <p className="max-w-[34ch] text-balance text-muted-foreground">{line}</p> : null}
      </div>
    </header>
  )
}
