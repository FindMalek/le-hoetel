import { cn } from "@ritorno/ui/lib/utils"

type PageHeaderProps = {
  title: React.ReactNode
  description?: React.ReactNode
  /** The one primary action, at the inline end. A pill `Button`. */
  action?: React.ReactNode
  /** Outline or ghost buttons placed before the primary action. */
  secondaryActions?: React.ReactNode
  breadcrumb?: React.ReactNode
  className?: string
}

function PageHeader({ title, description, action, secondaryActions, breadcrumb, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4", className)}>
      {breadcrumb}
      {/* The actions drop under the title when there is no room beside it, never squeeze it. */}
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="flex min-w-0 max-w-prose flex-col gap-1.5 md:min-w-64 md:flex-1">
          <h1 className="text-balance text-h1">{title}</h1>
          {description ? <p className="text-pretty text-muted-foreground">{description}</p> : null}
        </div>
        {action || secondaryActions ? (
          <div className="flex flex-wrap items-center gap-2 *:max-md:grow">
            {secondaryActions}
            {action}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export { PageHeader }
