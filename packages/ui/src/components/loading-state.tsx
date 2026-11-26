import { Skeleton } from "@ritorno/ui/components/skeleton"
import { cn } from "@ritorno/ui/lib/utils"

type LoadingStateProps = React.ComponentProps<"div"> & {
  label: string
}

function LoadingState({ label, className, children, ...props }: LoadingStateProps) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={cn("flex flex-col gap-3", className)} {...props}>
      <span className="sr-only">{label}</span>
      <div aria-hidden className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  )
}

function ListSkeleton({ rows = 5, label, className }: { rows?: number; label: string; className?: string }) {
  return (
    <LoadingState label={label} className={className}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </LoadingState>
  )
}

function CardSkeleton({ label, className }: { label: string; className?: string }) {
  return (
    <LoadingState label={label} className={cn("rounded-lg p-4 ring-1 ring-foreground/10", className)}>
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </LoadingState>
  )
}

export { CardSkeleton, ListSkeleton, LoadingState }
