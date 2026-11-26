import type * as React from "react"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ritorno/ui/components/empty"
import { ZelligePattern } from "@ritorno/ui/components/zellige-pattern"
import { cn } from "@ritorno/ui/lib/utils"

type EmptyStateProps = Omit<React.ComponentProps<typeof Empty>, "title"> & {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  /** The quiet zellige pattern behind the text. For first-run screens, not every list. */
  decorated?: boolean
}

function EmptyState({ icon, title, description, action, decorated, className, ...props }: EmptyStateProps) {
  return (
    <Empty className={cn("relative isolate overflow-hidden border py-12", className)} {...props}>
      {decorated ? (
        <div aria-hidden className="-z-10 absolute inset-0 mask-fade-center">
          <ZelligePattern />
        </div>
      ) : null}
      <EmptyHeader>
        {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}

export { EmptyState }
