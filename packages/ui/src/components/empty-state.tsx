import type * as React from "react"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@le-hoetel/ui/components/empty"

type EmptyStateProps = Omit<React.ComponentProps<typeof Empty>, "title"> & {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

function EmptyState({ icon, title, description, action, ...props }: EmptyStateProps) {
  return (
    <Empty className="border py-12" {...props}>
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
