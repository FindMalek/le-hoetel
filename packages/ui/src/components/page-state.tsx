import { EmptyState } from "@ritorno/ui/components/empty-state"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { CardSkeleton, ListSkeleton } from "@ritorno/ui/components/loading-state"
import { LockIcon } from "lucide-react"

type Message = {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

type PageStateProps =
  | { kind: "loading"; label: string; layout?: "list" | "card"; className?: string }
  | ({ kind: "empty"; icon?: React.ReactNode; firstRun?: boolean; className?: string } & Message)
  | ({ kind: "forbidden"; icon?: React.ReactNode; className?: string } & Message)
  | ({ kind: "error"; className?: string } & Message)

/** The four states a page or a panel shows when it has no content to render. Copy always comes from the caller. */
function PageState(props: PageStateProps) {
  switch (props.kind) {
    case "loading":
      return props.layout === "card" ? (
        <CardSkeleton label={props.label} className={props.className} />
      ) : (
        <ListSkeleton label={props.label} className={props.className} />
      )
    case "error":
      return (
        <InlineAlert tone="error" title={props.title} action={props.action} className={props.className}>
          {props.description}
        </InlineAlert>
      )
    case "forbidden":
      return (
        <EmptyState
          icon={props.icon ?? <LockIcon />}
          title={props.title}
          description={props.description}
          action={props.action}
          className={props.className}
        />
      )
    case "empty":
      return (
        <EmptyState
          icon={props.icon}
          title={props.title}
          description={props.description}
          action={props.action}
          decorated={props.firstRun}
          className={props.className}
        />
      )
  }
}

export { PageState }
