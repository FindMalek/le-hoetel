"use client"

import type { Guest } from "@le-hoetel/common/schemas"
import { LOCALE_NAMES } from "@le-hoetel/i18n"
import { Badge } from "@le-hoetel/ui/components/badge"
import { Button } from "@le-hoetel/ui/components/button"
import { type DataColumn, DataTable } from "@le-hoetel/ui/components/data-table"
import { ChevronRightIcon, MailIcon, MessageCircleIcon, Rows2Icon, Rows3Icon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { LocalDate } from "@/components/local-date"

const DENSITY_KEY = "guests-density"

export function ConsentBadges({ consents }: { consents: Guest["consents"] }) {
  const t = useTranslations("guests.consent")
  if (!consents.email && !consents.whatsapp) return <Badge variant="outline">{t("none")}</Badge>
  return (
    <span className="flex flex-wrap gap-1">
      {consents.whatsapp && (
        <Badge variant="secondary">
          <MessageCircleIcon data-icon="inline-start" />
          {t("whatsapp")}
        </Badge>
      )}
      {consents.email && (
        <Badge variant="secondary">
          <MailIcon data-icon="inline-start" />
          {t("email")}
        </Badge>
      )}
    </span>
  )
}

const Phone = ({ value }: { value: string }) => (
  <bdi dir="ltr" className="tabular-nums">
    {value}
  </bdi>
)

export function GuestList({ guests, total }: { guests: Guest[]; total: number }) {
  const t = useTranslations("guests")
  const [compact, setCompact] = useState(false)
  useEffect(() => setCompact(localStorage.getItem(DENSITY_KEY) === "compact"), [])
  const choose = (value: boolean) => {
    setCompact(value)
    localStorage.setItem(DENSITY_KEY, value ? "compact" : "comfortable")
  }
  const row = compact ? "h-11" : undefined

  const columns: DataColumn<Guest>[] = [
    {
      id: "guest",
      header: t("columns.guest"),
      className: row,
      cell: (guest) => (
        <Link
          href={`/guests/${guest.id}`}
          className="font-medium underline-offset-4 hover:underline focus-visible:underline"
        >
          {guest.name}
        </Link>
      ),
    },
    { id: "phone", header: t("columns.phone"), className: row, cell: (guest) => <Phone value={guest.phoneE164} /> },
    {
      id: "consent",
      header: t("columns.consent"),
      className: row,
      cell: (guest) => <ConsentBadges consents={guest.consents} />,
    },
    {
      id: "language",
      header: t("columns.language"),
      showFrom: "lg",
      className: row,
      cell: (guest) => LOCALE_NAMES[guest.language],
    },
    {
      id: "source",
      header: t("columns.source"),
      showFrom: "lg",
      className: row,
      cell: (guest) => <span className="text-muted-foreground">{t(`source.${guest.source}`)}</span>,
    },
    {
      id: "added",
      header: t("columns.added"),
      align: "end",
      className: row,
      cell: (guest) => (
        <span className="text-muted-foreground">
          <LocalDate value={guest.createdAt} />
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {t("total", { count: total })}
        </p>
        <fieldset
          className="m-0 flex min-w-0 items-center gap-1 border-0 p-0 max-md:hidden"
          aria-label={t("density.label")}
        >
          <Button
            variant={compact ? "ghost" : "secondary"}
            size="icon-sm"
            aria-label={t("density.comfortable")}
            aria-pressed={!compact}
            onClick={() => choose(false)}
          >
            <Rows2Icon />
          </Button>
          <Button
            variant={compact ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={t("density.compact")}
            aria-pressed={compact}
            onClick={() => choose(true)}
          >
            <Rows3Icon />
          </Button>
        </fieldset>
      </div>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={guests}
        getRowKey={(guest) => guest.id}
        card={(guest) => (
          <Link href={`/guests/${guest.id}`} className="-m-4 flex items-center gap-3 p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="truncate font-medium">{guest.name}</span>
              <span className="text-muted-foreground text-sm">
                <Phone value={guest.phoneE164} />
              </span>
              <ConsentBadges consents={guest.consents} />
              <span className="text-muted-foreground text-xs">
                {LOCALE_NAMES[guest.language]} · {t(`source.${guest.source}`)} · <LocalDate value={guest.createdAt} />
              </span>
            </div>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
          </Link>
        )}
      />
    </div>
  )
}
