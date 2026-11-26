import { cn } from "@ritorno/ui/lib/utils"

/** What a guest page shows instead of its content: a link that is not valid, an offer that expired, a page that failed. */
export function GuestState({
  icon,
  title,
  body,
  tone = "neutral",
  heading = "h2",
  children,
}: {
  icon: React.ReactNode
  title: string
  body: string
  tone?: "neutral" | "danger"
  heading?: "h1" | "h2"
  children?: React.ReactNode
}) {
  const Heading = heading
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center gap-4 py-10 text-center", heading === "h1" && "flex-1 justify-center")}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-14 items-center justify-center rounded-full [&_svg]:size-6",
          tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-surface text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <div className="grid max-w-sm gap-2">
        <Heading className="text-balance font-semibold text-h3 tracking-tight">{title}</Heading>
        <p className="text-pretty text-muted-foreground">{body}</p>
      </div>
      {children}
    </div>
  )
}
