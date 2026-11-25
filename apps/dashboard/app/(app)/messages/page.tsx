import { isForbidden } from "@le-hoetel/orpc/errors"
import { Badge } from "@le-hoetel/ui/components/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@le-hoetel/ui/components/table"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"
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
} as const

export default async function MessagesPage() {
  await connection()
  const t = await getTranslations("messages")
  const result = await call((api) => api.messages.list({})).catch((error) => {
    if (isForbidden(error)) return null
    throw error
  })
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
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
