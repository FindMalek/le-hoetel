import { Button } from "@ritorno/ui/components/button"
import { DataTable } from "@ritorno/ui/components/data-table"
import { LoadingState } from "@ritorno/ui/components/loading-state"
import { Num } from "@ritorno/ui/components/num"
import { Skeleton } from "@ritorno/ui/components/skeleton"
import { cn } from "cn"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

/** A link (server pages, state in the url) or a handler (client lists). Missing means there is no page that way. */
type PageTarget = { href: string } | { onClick: () => void }

type DataListPagination = {
  previousLabel: string
  nextLabel: string
  previous?: PageTarget
  next?: PageTarget
  /** Page mode: the rows shown, from `pageWindow`. `label` places the isolated numbers in the translated sentence. */
  range?: {
    from: number
    to: number
    total: number
    locale: string
    label: (numbers: { from: React.ReactNode; to: React.ReactNode; total: React.ReactNode }) => React.ReactNode
  }
  /** Cursor mode or anything else to show next to the buttons. */
  status?: React.ReactNode
}

function RangeStatus({ range }: { range: NonNullable<DataListPagination["range"]> }) {
  const num = (value: number) => <Num value={value} locale={range.locale} className="tabular-nums" />
  return <>{range.label({ from: num(range.from), to: num(range.to), total: num(range.total) })}</>
}

type DataListProps<T> = React.ComponentProps<typeof DataTable<T>> & {
  /** Search and filter controls above the list. */
  filters?: React.ReactNode
  /** Shows skeleton rows instead of the list, announced with `label`. */
  loading?: { label: string; rows?: number }
  pagination?: DataListPagination
  /** Link component for `href` targets, e.g. Next `Link`. */
  linkComponent?: React.ElementType
}

function PageButton({
  target,
  label,
  icon,
  LinkComponent,
}: {
  target?: PageTarget
  label: string
  icon: React.ReactNode
  LinkComponent: React.ElementType
}) {
  if (target && "href" in target) {
    return (
      <Button variant="outline" nativeButton={false} render={<LinkComponent href={target.href} />}>
        {icon}
        {label}
      </Button>
    )
  }
  return (
    <Button variant="outline" disabled={!target} onClick={target?.onClick}>
      {icon}
      {label}
    </Button>
  )
}

function DataListSkeleton({ label, rows = 5 }: { label: string; rows?: number }) {
  return (
    <LoadingState label={label} className="gap-0 rounded-lg border">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-b p-4 last:border-b-0 md:h-14 md:py-0">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 flex-1 max-md:hidden" />
          <Skeleton className="ms-auto h-4 w-16" />
        </div>
      ))}
    </LoadingState>
  )
}

/** The one list of the app: filters, a table from `md` up and cards on phones, loading rows, empty state, paging. */
function DataList<T>({
  filters,
  loading,
  pagination,
  linkComponent = "a",
  className,
  ...table
}: DataListProps<T>) {
  const pager = pagination ? (
    <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-small">
      <span aria-live="polite">
        {pagination.range ? <RangeStatus range={pagination.range} /> : pagination.status}
      </span>
      <div className="flex gap-2 max-sm:w-full *:max-sm:flex-1">
        <PageButton
          target={pagination.previous}
          label={pagination.previousLabel}
          icon={<ChevronLeftIcon data-icon="inline-start" className="rtl:rotate-180" />}
          LinkComponent={linkComponent}
        />
        <PageButton
          target={pagination.next}
          label={pagination.nextLabel}
          icon={<ChevronRightIcon data-icon="inline-end" className="order-last rtl:rotate-180" />}
          LinkComponent={linkComponent}
        />
      </div>
    </div>
  ) : null
  const showPager = pager && (pagination?.previous || pagination?.next || table.rows.length > 0)

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {filters ? <div className="flex flex-wrap items-end gap-3">{filters}</div> : null}
      {loading ? (
        <DataListSkeleton label={loading.label} rows={loading.rows} />
      ) : (
        <DataTable<T> {...table} />
      )}
      {!loading && showPager ? pager : null}
    </div>
  )
}

export { DataList, type DataListPagination, type PageTarget }
