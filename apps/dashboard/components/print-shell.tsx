import { ArrowLeftIcon } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { QrKitPrintButton } from "@/components/qr-kit-print-button"

/**
 * The frame of a print page: a toolbar on screen, and on paper only the pages in `children`, at `size` with no margin.
 */
export async function PrintShell({
  size,
  title,
  paper,
  pages,
  note,
  controls,
  children,
}: {
  /** The CSS `@page` size, e.g. `A4` or `105mm 148mm`. */
  size: string
  title: string
  paper: string
  pages: number
  note?: string
  controls?: React.ReactNode
  children: React.ReactNode
}) {
  const t = await getTranslations("qrKit")
  return (
    <main data-print-root className="min-h-dvh bg-blue-50 print:min-h-0 print:bg-white">
      {/* the paper size depends on the piece, so it cannot live in the theme css */}
      {/* oxlint-disable-next-line shadcn/no-inline-styles */}
      <style>{`@page { size: ${size}; margin: 0 }
@media print { body { padding: 0 !important } body > :not([data-print-root]) { display: none !important } }`}</style>
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6 print:hidden">
        <Link href="/qr-codes" className="flex min-h-touch items-center gap-2 self-start text-sm">
          <ArrowLeftIcon aria-hidden className="size-4 rtl:rotate-180" />
          {t("back")}
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="font-heading font-semibold text-h2 tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{t("hint", { paper })}</p>
          {note ? <p className="text-muted-foreground text-sm">{note}</p> : null}
        </div>
        {controls}
        <div className="flex flex-wrap items-center gap-3">
          {pages ? <QrKitPrintButton label={t("print")} /> : null}
          <p className="text-muted-foreground text-sm tabular-nums">{t("pages", { count: pages })}</p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-6 px-4 pb-10 print:block print:p-0">{children}</div>
    </main>
  )
}

/** A row of links where one is current: the pieces or languages of a print page. */
export function Choices({
  label,
  items,
}: {
  label: string
  items: { key: string; label: string; href: `/print/${string}`; current: boolean; lang?: string }[]
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 rounded-xl border bg-background p-1">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href as Route}
          replace
          prefetch={false}
          lang={item.lang}
          aria-current={item.current ? "true" : undefined}
          className="flex min-h-touch flex-1 items-center justify-center rounded-lg px-3 text-muted-foreground text-sm hover:text-foreground aria-[current=true]:bg-accent aria-[current=true]:font-medium aria-[current=true]:text-foreground"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
