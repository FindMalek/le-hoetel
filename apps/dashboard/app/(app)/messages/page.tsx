import { MESSAGE_CHANNELS, type MessageChannel } from "@ritorno/common/consent"
import { HOTEL_EMAIL_KEYS, MESSAGE_STATUSES, type MessageStatus } from "@ritorno/common/message"
import { formatTnd } from "@ritorno/common/pricing"
import { isForbidden } from "@ritorno/orpc/errors"
import { Button } from "@ritorno/ui/components/button"
import { DataList } from "@ritorno/ui/components/data-list"
import type { DataColumn } from "@ritorno/ui/components/data-table"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { PageState } from "@ritorno/ui/components/page-state"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { StatusBadge, type StatusTone } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { pageWindow } from "@ritorno/ui/lib/pagination"
import { MailIcon, MessageCircleIcon, SendIcon, XIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { getLocale, getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"
import { MessageFilterSelect } from "./message-filter-select"

export const metadata: Metadata = { title: "Messages" }

const PAGE_SIZE = 25
const PERIODS = ["7", "30", "90"] as const

const STATUS_TONE: Record<MessageStatus, StatusTone> = {
  queued: "neutral",
  sent: "info",
  delivered: "success",
  failed: "danger",
  skipped_no_consent: "neutral",
  skipped_no_balance: "warning",
}

type Filters = {
  channel?: MessageChannel
  status?: MessageStatus
  template?: (typeof HOTEL_EMAIL_KEYS)[number]
  days?: (typeof PERIODS)[number]
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const oneOf = <T extends string>(options: readonly T[], value: string | undefined) =>
  options.find((option) => option === value)

function parseSearch(raw: Record<string, string | string[] | undefined>): Filters & { page: number } {
  return {
    channel: oneOf(MESSAGE_CHANNELS, first(raw.channel)),
    status: oneOf(MESSAGE_STATUSES, first(raw.status)),
    template: oneOf(HOTEL_EMAIL_KEYS, first(raw.template)),
    days: oneOf(PERIODS, first(raw.days)),
    page: Number(first(raw.page)),
  }
}

function href(filters: Filters, patch: Partial<Filters> & { page?: number }) {
  const params = new URLSearchParams()
  const { page, ...next } = { ...filters, ...patch }
  for (const [key, value] of Object.entries(next)) if (value) params.set(key, value)
  if (page && page > 1) params.set("page", String(page))
  const text = params.toString()
  return text ? `/messages?${text}` : "/messages"
}

const ChannelIcon = ({ channel }: { channel: MessageChannel }) =>
  channel === "email" ? (
    <MailIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
  ) : (
    <MessageCircleIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
  )

export default async function MessagesPage({ searchParams }: PageProps<"/messages">) {
  await connection()
  const { page: requested, ...filters } = parseSearch(await searchParams)
  const [t, locale] = await Promise.all([getTranslations("messages"), getLocale()])
  const start = Number.isInteger(requested) && requested > 1 ? requested : 1
  const [result, balance, hotel] = await Promise.all([
    call((api) =>
      api.messages.list({
        channel: filters.channel,
        status: filters.status,
        template: filters.template,
        days: filters.days ? Number(filters.days) : undefined,
        limit: PAGE_SIZE,
        offset: (start - 1) * PAGE_SIZE,
      }),
    ).catch((error) => {
      if (isForbidden(error)) return null
      throw error
    }),
    call((api) => api.hotel.balance.get()).catch(() => null),
    call((api) => api.hotel.get()).catch(() => null),
  ])
  const timeZone = hotel?.timezone
  const header = <PageHeader title={t("title")} description={t("description")} />

  if (!result) {
    return (
      <>
        {header}
        <div className="p-4 md:p-6">
          <PageState kind="forbidden" title={t("forbiddenTitle")} description={t("forbiddenBody")} />
        </div>
      </>
    )
  }

  type Row = (typeof result.items)[number]
  const filtered = Boolean(filters.channel || filters.status || filters.template || filters.days)
  const page = pageWindow({ page: start, pageSize: PAGE_SIZE, total: result.total })
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    numberingSystem: "latn",
    timeZone,
  })
  const when = (row: Row) => (
    <time dateTime={row.createdAt.toISOString()} className="tabular-nums">
      {formatDate(row.createdAt, locale, timeZone)} · <bdi dir="ltr">{time.format(row.createdAt)}</bdi>
    </time>
  )
  const template = (key: string) => {
    const known = oneOf(HOTEL_EMAIL_KEYS, key)
    return known ? t(`templates.${known}`) : key
  }
  const status = (row: Row) => (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge tone={STATUS_TONE[row.status]}>{t(`statuses.${row.status}`)}</StatusBadge>
      {row.status === "failed" && row.errorCode ? (
        <bdi dir="ltr" className="font-mono text-muted-foreground text-xs">
          {row.errorCode}
        </bdi>
      ) : null}
    </span>
  )
  const guest = (row: Row) => (
    <Link
      href={`/guests/${row.guestId}`}
      className="font-medium underline-offset-4 hover:underline focus-visible:underline"
    >
      {row.guestName}
    </Link>
  )

  const columns: DataColumn<Row>[] = [
    { id: "date", header: t("date"), cell: (row) => <span className="text-muted-foreground">{when(row)}</span> },
    { id: "guest", header: t("guest"), cell: guest },
    {
      id: "channel",
      header: t("channel"),
      cell: (row) => (
        <span className="flex items-center gap-2">
          <ChannelIcon channel={row.channel} />
          {t(`channels.${row.channel}`)}
        </span>
      ),
    },
    { id: "template", header: t("template"), cell: (row) => template(row.templateKey) },
    {
      id: "language",
      header: t("language"),
      showFrom: "lg",
      cell: (row) => <span className="text-muted-foreground uppercase">{row.language}</span>,
    },
    { id: "status", header: t("status"), cell: status },
  ]

  const card = (row: Row) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate">{guest(row)}</span>
        {status(row)}
      </div>
      <span className="flex items-center gap-2 text-sm">
        <ChannelIcon channel={row.channel} />
        {template(row.templateKey)}
        <span className="text-muted-foreground">· {t(`channels.${row.channel}`)}</span>
      </span>
      <span className="text-muted-foreground text-xs">{when(row)}</span>
    </div>
  )

  const segment = (label: string, value: string, options: { value: string; label: string; href: string }[]) => (
    <div className="col-span-2 flex flex-col gap-1.5">
      <span aria-hidden className="font-medium text-sm">
        {label}
      </span>
      <SegmentedControl label={label} value={value} options={options} linkComponent={Link} block />
    </div>
  )

  const filterControls = (
    <div className="grid w-full grid-cols-2 items-end gap-3 md:flex md:flex-wrap">
      {segment(t("filters.channel"), filters.channel ?? "all", [
        { value: "all", label: t("filters.all"), href: href(filters, { channel: undefined }) },
        ...MESSAGE_CHANNELS.map((value) => ({
          value,
          label: t(`channels.${value}`),
          href: href(filters, { channel: value }),
        })),
      ])}
      {segment(t("filters.period"), filters.days ?? "all", [
        ...PERIODS.map((value) => ({
          value,
          label: t("filters.days", { count: Number(value) }),
          href: href(filters, { days: value }),
        })),
        { value: "all", label: t("filters.all"), href: href(filters, { days: undefined }) },
      ])}
      <MessageFilterSelect
        name="status"
        label={t("filters.status")}
        value={filters.status}
        options={[
          { value: "any", label: t("filters.anyStatus") },
          ...MESSAGE_STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) })),
        ]}
      />
      <MessageFilterSelect
        name="template"
        label={t("filters.template")}
        value={filters.template}
        options={[
          { value: "any", label: t("filters.anyTemplate") },
          ...HOTEL_EMAIL_KEYS.map((value) => ({ value, label: t(`templates.${value}`) })),
        ]}
      />
      {filtered ? (
        <Button
          variant="ghost"
          className="col-span-2 w-fit coarse:h-11"
          render={<Link href="/messages" replace />}
          nativeButton={false}
        >
          <XIcon data-icon="inline-start" />
          {t("filters.reset")}
        </Button>
      ) : null}
    </div>
  )

  const empty = filtered ? (
    <PageState
      kind="empty"
      icon={<SendIcon />}
      title={t("noMatchTitle")}
      description={t("noMatchBody")}
      action={
        <Button variant="outline" render={<Link href="/messages" />} nativeButton={false}>
          {t("filters.reset")}
        </Button>
      }
    />
  ) : (
    <PageState kind="empty" firstRun icon={<SendIcon />} title={t("emptyTitle")} description={t("emptyBody")} />
  )

  return (
    <>
      {header}
      <div className="flex flex-col gap-4 p-4 md:p-6">
        {balance?.low ? (
          <InlineAlert
            tone="warning"
            title={t("lowBalance")}
            action={
              <Button variant="outline" size="sm" render={<Link href="/usage" />} nativeButton={false}>
                {t("seeUsage")}
              </Button>
            }
          >
            {t("lowBalanceHint", { balance: formatTnd(balance.balanceMillimes, locale) })}
          </InlineAlert>
        ) : null}
        <DataList<Row>
          caption={t("caption")}
          filters={result.total > 0 || filtered ? filterControls : undefined}
          rows={result.items}
          columns={columns}
          card={card}
          getRowKey={(row) => row.id}
          empty={empty}
          linkComponent={Link}
          pagination={{
            previousLabel: t("previous"),
            nextLabel: t("next"),
            range: {
              ...page,
              total: result.total,
              locale,
              label: (n) => t.rich("range", { from: () => n.from, to: () => n.to, total: () => n.total }),
            },
            previous: page.hasPrevious ? { href: href(filters, { page: page.page - 1 }) } : undefined,
            next: page.hasNext ? { href: href(filters, { page: page.page + 1 }) } : undefined,
          }}
        />
      </div>
    </>
  )
}
