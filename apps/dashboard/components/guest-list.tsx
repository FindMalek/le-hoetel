import type { Guest } from "@le-hoetel/common/schemas"
import { LOCALE_NAMES } from "@le-hoetel/i18n"
import { Badge } from "@le-hoetel/ui/components/badge"
import { Card, CardContent } from "@le-hoetel/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@le-hoetel/ui/components/table"
import { getTranslations } from "next-intl/server"
import { LocalDate } from "@/components/local-date"

const CHANNELS = ["email", "whatsapp", "profile"] as const

async function ConsentBadges({ consents }: { consents: Guest["consents"] }) {
  const t = await getTranslations("guests.consent")
  const granted = CHANNELS.filter((channel) => consents[channel])
  if (!granted.length) return <Badge variant="outline">{t("none")}</Badge>
  return (
    <span className="flex flex-wrap gap-1">
      {granted.map((channel) => (
        <Badge key={channel} variant="secondary">
          {t(channel)}
        </Badge>
      ))}
    </span>
  )
}

const Phone = ({ value }: { value: string }) => (
  <bdi dir="ltr" className="tabular-nums">
    {value}
  </bdi>
)

/** Cards on phones, a table from `md` up: one list, two layouts, no horizontal scrolling on a phone. */
export async function GuestList({ guests }: { guests: Guest[] }) {
  const t = await getTranslations("guests")
  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {guests.map((guest) => (
          <li key={guest.id}>
            <Card size="sm">
              <CardContent className="grid gap-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{guest.name}</span>
                  <Badge variant="outline">{t(`source.${guest.source}`)}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3 text-muted-foreground text-sm">
                  <Phone value={guest.phoneE164} />
                  <span>{LOCALE_NAMES[guest.language]}</span>
                </div>
                <ConsentBadges consents={guest.consents} />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.guest")}</TableHead>
              <TableHead>{t("columns.phone")}</TableHead>
              <TableHead>{t("columns.language")}</TableHead>
              <TableHead>{t("columns.source")}</TableHead>
              <TableHead>{t("columns.consent")}</TableHead>
              <TableHead>{t("columns.added")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guests.map((guest) => (
              <TableRow key={guest.id}>
                <TableCell className="font-medium">{guest.name}</TableCell>
                <TableCell>
                  <Phone value={guest.phoneE164} />
                </TableCell>
                <TableCell>{LOCALE_NAMES[guest.language]}</TableCell>
                <TableCell>{t(`source.${guest.source}`)}</TableCell>
                <TableCell>
                  <ConsentBadges consents={guest.consents} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <LocalDate value={guest.createdAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
