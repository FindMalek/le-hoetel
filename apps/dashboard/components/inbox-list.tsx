"use client"

import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { PageState } from "@ritorno/ui/components/page-state"
import { formatDate } from "@ritorno/ui/lib/date"
import { cn } from "@ritorno/ui/lib/utils"
import { useMutation } from "@tanstack/react-query"
import { CheckCheckIcon, CheckIcon, InboxIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

interface Item {
  id: string
  title: string
  body: string | null
  href: string | null
  readAt: Date | null
  createdAt: Date
}

const DAY = 86_400_000

function groupByDay(items: Item[], dayOf: (value: Date) => string): { day: string; items: Item[] }[] {
  const groups: { day: string; items: Item[] }[] = []
  for (const item of items) {
    const day = dayOf(item.createdAt)
    const last = groups.at(-1)
    if (last?.day === day) last.items.push(item)
    else groups.push({ day, items: [item] })
  }
  return groups
}

export function InboxList({ items, unread, timeZone }: { items: Item[]; unread: number; timeZone?: string }) {
  const t = useTranslations("inbox")
  const locale = useLocale()
  const router = useRouter()
  const done = () => router.refresh()
  const onError = (error: Error) => toast.error(errorMessage(error))
  const markRead = useMutation(orpc.inbox.markRead.mutationOptions({ onSuccess: done, onError }))
  const markAll = useMutation(orpc.inbox.markAllRead.mutationOptions({ onSuccess: done, onError }))

  if (items.length === 0) {
    return <PageState kind="empty" icon={<InboxIcon />} title={t("emptyTitle")} description={t("emptyBody")} />
  }

  const dayOf = (value: Date) => formatDate(value, locale, timeZone)
  const now = Date.now()
  const label = (day: string) =>
    day === dayOf(new Date(now)) ? t("today") : day === dayOf(new Date(now - DAY)) ? t("yesterday") : day
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    numberingSystem: "latn",
    timeZone,
  })

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {unread > 0 ? (
        <Button
          variant="outline"
          className="w-fit coarse:h-11"
          loading={markAll.isPending}
          onClick={() => markAll.mutate({})}
        >
          <CheckCheckIcon data-icon="inline-start" />
          {t("markAll")}
        </Button>
      ) : null}
      {groupByDay(items, dayOf).map((group) => (
        <section key={group.day} className="flex flex-col gap-2" aria-label={label(group.day)}>
          <h2 className="font-medium text-muted-foreground text-sm" suppressHydrationWarning>
            {label(group.day)}
          </h2>
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {group.items.map((item) => {
              const isUnread = !item.readAt
              return (
                <li key={item.id} className={cn("flex items-start gap-3 p-4", !isUnread && "bg-surface/40")}>
                  <span
                    aria-hidden
                    className={cn("mt-2 size-2 shrink-0 rounded-full", isUnread ? "bg-info" : "bg-transparent")}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p
                      dir="auto"
                      className={cn("text-pretty text-start", isUnread ? "font-semibold" : "text-muted-foreground")}
                    >
                      {isUnread ? <span className="sr-only">{t("new")}: </span> : null}
                      {item.title}
                    </p>
                    {item.body ? (
                      <p dir="auto" className="text-pretty text-start text-muted-foreground text-sm">
                        {item.body}
                      </p>
                    ) : null}
                    <time
                      dateTime={item.createdAt.toISOString()}
                      className="text-muted-foreground text-xs tabular-nums"
                      suppressHydrationWarning
                    >
                      <bdi dir="ltr">{time.format(item.createdAt)}</bdi>
                    </time>
                    {item.href || isUnread ? (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {item.href ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="coarse:h-11"
                            render={<a href={item.href} />}
                            nativeButton={false}
                            onClick={() => isUnread && markRead.mutate({ id: item.id })}
                          >
                            {t("open")}
                          </Button>
                        ) : null}
                        {isUnread ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="coarse:h-11"
                            disabled={markRead.isPending && markRead.variables?.id === item.id}
                            onClick={() => markRead.mutate({ id: item.id })}
                          >
                            <CheckIcon data-icon="inline-start" />
                            {t("markRead")}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
