import { formatTnd } from "@ritorno/common/pricing"
import { isForbidden } from "@ritorno/orpc/errors"
import { Badge } from "@ritorno/ui/components/badge"
import { Button } from "@ritorno/ui/components/button"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ritorno/ui/components/table"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { getLocale, getTranslations } from "next-intl/server"
import { LocalDate } from "@/components/local-date"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Messages" }

const STATUS_VARIANT = {
  queued: "outline",
  sent: "secondary",
  delivered: "default",
  failed: "destructive",
  skipped_no_consent: "outline",
  skipped_no_balance: "outline",
} as const

export default async function MessagesPage() {
  await connection()
  const [t, locale] = await Promise.all([getTranslations("messages"), getLocale()])
  const [result, balance] = await Promise.all([
    call((api) => api.messages.list({})).catch((error) => {
      if (isForbidden(error)) return null
      throw error
    }),
    call((api) => api.hotel.balance.get()).catch(() => null),
  ])
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
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
        {!result || result.items.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("guest")}</TableHead>
                <TableHead>{t("channel")}</TableHead>
                <TableHead>{t("template")}</TableHead>
                <TableHead>{t("language")}</TableHead>
                <TableHead>{t("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <LocalDate value={item.createdAt} time />
                  </TableCell>
                  <TableCell>{item.guestName}</TableCell>
                  <TableCell>{t(`channels.${item.channel}`)}</TableCell>
                  <TableCell className="font-mono text-xs">{item.templateKey}</TableCell>
                  <TableCell className="uppercase">{item.language}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[item.status]}>{t(`statuses.${item.status}`)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  )
}
