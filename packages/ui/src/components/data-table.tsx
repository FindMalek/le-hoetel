import { cn } from "@ritorno/ui/lib/utils"

type Breakpoint = "md" | "lg" | "xl"

const SHOW_FROM: Record<Breakpoint, string> = {
  md: "max-md:hidden",
  lg: "max-lg:hidden",
  xl: "max-xl:hidden",
}

type DataColumn<T> = {
  id: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  align?: "start" | "end"
  /** Hide the column below this breakpoint on the table. */
  showFrom?: Breakpoint
  className?: string
}

type DataTableProps<T> = {
  columns: DataColumn<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  /** Phone layout of one row. Default: the first column as the title, the other columns as label and value. */
  card?: (row: T) => React.ReactNode
  caption: string
  empty?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

function DefaultCard<T>({ row, columns }: { row: T; columns: DataColumn<T>[] }) {
  const [first, ...rest] = columns
  return (
    <div className="flex flex-col gap-2">
      <div className="font-medium">{first?.cell(row)}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {rest.map((column) => (
          <div key={column.id} className="col-span-2 grid grid-cols-subgrid items-baseline">
            <dt className="text-muted-foreground">{column.header}</dt>
            <dd className="min-w-0 text-end">{column.cell(row)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** A table from `md` up (sticky header, row hover), a list of cards on phones. The caller passes the empty state. */
function DataTable<T>({ columns, rows, getRowKey, card, caption, empty, footer, className }: DataTableProps<T>) {
  if (rows.length === 0 && empty) return <>{empty}</>
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <ul className="flex flex-col divide-y rounded-lg border bg-card md:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)} className="p-4">
            {card ? card(row) : <DefaultCard row={row} columns={columns} />}
          </li>
        ))}
      </ul>
      <div className="rounded-lg border max-md:hidden">
        <table className="w-full caption-top text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    "sticky top-[var(--app-header,0px)] z-10 h-11 border-b bg-background px-4 text-start font-medium text-muted-foreground first:rounded-ss-lg last:rounded-se-lg",
                    column.align === "end" && "text-end",
                    column.showFrom && SHOW_FROM[column.showFrom],
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="border-b transition-colors last:border-b-0 hover:bg-muted/50">
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      "h-14 px-4",
                      column.align === "end" && "text-end tabular-nums",
                      column.showFrom && SHOW_FROM[column.showFrom],
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  )
}

export { DataTable, type DataColumn }
