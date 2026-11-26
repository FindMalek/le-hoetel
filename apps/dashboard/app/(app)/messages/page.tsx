import { MESSAGE_CHANNELS, type MessageChannel } from "@ritorno/common/consent"
import { HOTEL_EMAIL_KEYS, MESSAGE_STATUSES, type MessageStatus } from "@ritorno/common/message"
import { formatTnd } from "@ritorno/common/pricing"
import { isForbidden } from "@ritorno/orpc/errors"
import { Button } from "@ritorno/ui/components/button"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { PageState } from "@ritorno/ui/components/page-state"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { SendIcon, XIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { getLocale, getTranslations } from "next-intl/server"
import { MessagesList } from "@/components/messages-list"
import { PageHeader } from "@/components/page-header"
import { call, getQueryClient, serverOrpc } from "@/lib/api"
import { messagesList } from "@/lib/lists"
import { MessageFilterSelect } from "./message-filter-select"

export const metadata: Metadata = { title: "Messages" }

const PERIODS = ["7", "30", "90"] as const

type Filters = {
  channel?: MessageChannel
  status?: MessageStatus
  template?: (typeof HOTEL_EMAIL_KEYS)[number]
  days?: (typeof PERIODS)[number]
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
const oneOf = <T extends string>(options: readonly T[], value: string | undefined) =>
  options.find((option) => option === value)

function parseSearch(raw: Record<string, string | string[] | undefined>): Filters {
  return {
    channel: oneOf(MESSAGE_CHANNELS, first(raw.channel)),
    status: oneOf(MESSAGE_STATUSES, first(raw.status)),
    template: oneOf(HOTEL_EMAIL_KEYS, first(raw.template)),
    days: oneOf(PERIODS, first(raw.days)),
  }
}

function href(filters: Filters, patch: Partial<Filters>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...filters, ...patch })) if (value) params.set(key, value)
  const text = params.toString()
  return text ? `/messages?${text}` : "/messages"
}

export default async function MessagesPage({ searchParams }: PageProps<"/messages">) {
  await connection()
  const filters = parseSearch(await searchParams)
  const [t, locale] = await Promise.all([getTranslations("messages"), getLocale()])
  const query = {
    channel: filters.channel,
    status: filters.status,
    template: filters.template,
    days: filters.days ? Number(filters.days) : undefined,
  }
  const queryClient = getQueryClient()
  const [{ activeId }, balance, hotel] = await Promise.all([
    call((api) => api.hotel.mine()),
    call((api) => api.hotel.balance.get()).catch(() => null),
    call((api) => api.hotel.get()).catch(() => null),
  ])
  const hotelId = activeId ?? ""
  const allowed = await call(() => queryClient.fetchInfiniteQuery(messagesList(serverOrpc, hotelId, query))).then(
    () => true,
    (error) => {
      if (isForbidden(error)) return false
      throw error
    },
  )
  const timeZone = hotel?.timezone
  const header = <PageHeader title={t("title")} description={t("description")} />

  if (!allowed) {
    return (
      <>
        {header}
        <div className="p-4 md:p-6">
          <PageState kind="forbidden" title={t("forbiddenTitle")} description={t("forbiddenBody")} />
        </div>
      </>
    )
  }

  const filtered = Boolean(filters.channel || filters.status || filters.template || filters.days)

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
        <HydrationBoundary state={dehydrate(queryClient)}>
          <MessagesList
            hotelId={hotelId}
            query={query}
            timeZone={timeZone}
            filtered={filtered}
            filters={filterControls}
            empty={empty}
          />
        </HydrationBoundary>
      </div>
    </>
  )
}
