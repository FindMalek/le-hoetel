"use client"

import { OFFER_CODE_MAX, type OfferLookup } from "@ritorno/common/schemas"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { Input } from "@ritorno/ui/components/input"
import { Label } from "@ritorno/ui/components/label"
import { Section } from "@ritorno/ui/components/section"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { formatDate } from "@ritorno/ui/lib/date"
import { cn } from "@ritorno/ui/lib/utils"
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CameraIcon, CheckCircle2Icon, CircleAlertIcon, XCircleIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { type FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"
import { redemptionsList } from "@/lib/lists"
import { LoadMore } from "./load-more"
import { canScanQr, QrScanner } from "./qr-scanner"

type Tone = "good" | "warn" | "bad"

const TONE = {
  good: { icon: CheckCircle2Icon, panel: "bg-success text-background", mark: "" },
  warn: { icon: CircleAlertIcon, panel: "bg-warning-soft text-foreground", mark: "text-warning" },
  bad: { icon: XCircleIcon, panel: "bg-destructive-soft text-foreground", mark: "text-destructive" },
} as const

function toneOf(result: OfferLookup): Tone {
  if (result.status === "ready" || (result.status === "redeemed" && result.justNow)) return "good"
  return result.status === "wrongHotel" || result.status === "unknown" ? "bad" : "warn"
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-card px-3 py-2.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-heading font-semibold text-2xl tabular-nums">{value ?? "–"}</span>
    </div>
  )
}

function buzz(good: boolean) {
  navigator.vibrate?.(good ? 60 : [80, 60, 80])
}

/** `timeZone` is the hotel's, so a validity date never shifts by a day near midnight. */
export function RedeemScreen({ hotelId, timeZone }: { hotelId: string; timeZone?: string }) {
  const t = useTranslations("redeem")
  const tList = useTranslations("loadMore")
  const locale = useLocale()
  const day = (value: Date) => formatDate(value, locale, timeZone)
  const clock = (value: Date) =>
    new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", numberingSystem: "latn", timeZone }).format(
      value,
    )
  const moment = (value: Date) => (
    <time dateTime={value.toISOString()} suppressHydrationWarning>
      {day(value)} · <bdi dir="ltr">{clock(value)}</bdi>
    </time>
  )
  const queryClient = useQueryClient()
  const stats = useQuery(orpc.offers.redemptionStats.queryOptions())
  const history = useInfiniteQuery(redemptionsList(orpc, hotelId))
  const rows = history.data?.pages.flatMap((page) => page.items) ?? []
  const [scanning, setScanning] = useState(false)
  const [supported, setSupported] = useState(true)
  const [typed, setTyped] = useState("")
  const [code, setCode] = useState("")
  const [result, setResult] = useState<OfferLookup | null>(null)
  useEffect(() => setSupported(canScanQr()), [])

  const onError = (error: Error) => toast.error(errorMessage(error))
  const show = (next: OfferLookup) => {
    setResult(next)
    buzz(next.status === "ready" || (next.status === "redeemed" && next.justNow))
  }
  const lookup = useMutation(orpc.offers.lookup.mutationOptions({ onSuccess: show, onError }))
  const redeem = useMutation(
    orpc.offers.redeem.mutationOptions({
      onSuccess: (done) => {
        show(done)
        return queryClient.invalidateQueries({ queryKey: orpc.offers.key() })
      },
      onError,
    }),
  )

  function check(value: string) {
    const next = value.trim()
    if (!next) return
    setScanning(false)
    setCode(next)
    setResult(null)
    lookup.mutate({ code: next })
  }
  const reset = () => {
    setCode("")
    setTyped("")
    setResult(null)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    check(typed)
  }

  if (result) {
    const done = result.status === "redeemed" && result.justNow
    const tone = toneOf(result)
    const { icon: Icon, panel, mark } = TONE[tone]
    return (
      <div className="flex flex-col gap-6">
        <div
          role={tone === "good" ? "status" : "alert"}
          className={cn(
            "flex min-h-[40dvh] flex-col items-center justify-center gap-4 rounded-3xl p-6 text-center md:min-h-80",
            panel,
          )}
        >
          <Icon className={cn("size-20 md:size-24", mark)} strokeWidth={1.5} aria-hidden />
          <p className="text-balance font-heading font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
            {done ? t("justNow") : t(`status.${result.status}`)}
          </p>
          {result.guestFirstName ? (
            <p className="font-semibold text-2xl">
              <span className="sr-only">{t("guest")}: </span>
              {result.guestFirstName}
            </p>
          ) : null}
          {result.offer ? (
            <p dir="auto" className="text-balance text-lg opacity-90">
              {result.offer.title}
            </p>
          ) : null}
          {tone !== "good" ? (
            <p className="max-w-sm text-pretty text-muted-foreground">{t(`hints.${result.status as "expired"}`)}</p>
          ) : null}
        </div>

        <dl className="grid gap-4 text-base">
          {result.offer?.text ? (
            <p dir="auto" className="text-start text-muted-foreground">
              {result.offer.text}
            </p>
          ) : null}
          {result.offer ? (
            <div className="flex items-baseline justify-between gap-4 border-b pb-3">
              <dt className="text-muted-foreground">{t("validUntil")}</dt>
              <dd>{result.offer.validUntil ? day(result.offer.validUntil) : t("noEnd")}</dd>
            </div>
          ) : null}
          {result.redeemed ? (
            <div className="flex items-baseline justify-between gap-4 border-b pb-3">
              <dt className="text-muted-foreground">{t("redeemedAt")}</dt>
              <dd className="text-end">
                {moment(result.redeemed.at)}
                {result.redeemed.by ? (
                  <span className="block text-muted-foreground text-sm">
                    {t("redeemedBy")} {result.redeemed.by}
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>

        <StickyFormActions>
          {result.status === "ready" ? (
            <Button
              size="lg"
              className="h-16 text-lg"
              loading={redeem.isPending}
              onClick={() => redeem.mutate({ code })}
            >
              {t("redeem")}
            </Button>
          ) : null}
          <Button
            variant={result.status === "ready" ? "outline" : "default"}
            size="lg"
            className="h-14 text-base"
            onClick={reset}
          >
            {t("next")}
          </Button>
        </StickyFormActions>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="relative isolate aspect-square w-full overflow-hidden rounded-3xl bg-muted md:aspect-video">
          {scanning ? (
            <>
              <QrScanner
                label={t("scanLabel")}
                onCode={check}
                onFail={() => {
                  setScanning(false)
                  toast.error(t("cameraFailed"))
                }}
              />
              <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="size-2/3 max-w-72 rounded-3xl border-4 border-primary-foreground/90 shadow-[0_0_0_9999px_oklch(0_0_0/0.35)]" />
              </div>
              <p className="absolute inset-x-4 bottom-4 text-center font-medium text-primary-foreground text-sm drop-shadow">
                {t("scanning")}
              </p>
            </>
          ) : supported ? (
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-foreground transition-colors hover:bg-muted-foreground/10 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-4"
            >
              <span className="grid size-24 place-items-center rounded-full bg-primary text-primary-foreground">
                <CameraIcon className="size-10" aria-hidden />
              </span>
              <span className="font-heading font-semibold text-2xl tracking-tight">{t("scan")}</span>
              <span className="max-w-64 text-pretty text-muted-foreground text-sm">{t("scanHint")}</span>
            </button>
          ) : (
            <p className="absolute inset-0 grid place-items-center p-8 text-center text-muted-foreground">
              {t("noCamera")}
            </p>
          )}
        </div>
        {scanning ? (
          <Button variant="outline" size="lg" onClick={() => setScanning(false)}>
            {t("stopScan")}
          </Button>
        ) : null}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <Label htmlFor="redeem-code" className="text-base">
          {t("typeCode")}
        </Label>
        <div className="flex gap-2">
          <Input
            id="redeem-code"
            dir="ltr"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={OFFER_CODE_MAX}
            placeholder={t("codePlaceholder")}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="h-14 font-mono text-lg tracking-widest md:text-lg"
          />
          <Button
            type="submit"
            size="lg"
            className="h-14 px-6 text-base"
            loading={lookup.isPending}
            disabled={!typed.trim()}
          >
            {t("check")}
          </Button>
        </div>
      </form>

      <Section title={t("recent")}>
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t("today")} value={stats.data?.today} />
          <Stat label={t("week")} value={stats.data?.week} />
          <Stat label={t("total")} value={stats.data?.total} />
        </div>
        {rows.length ? (
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="flex min-w-0 flex-col">
                  <span dir="auto" className="truncate text-start font-medium">
                    {row.offerTitle}
                  </span>
                  {row.guestFirstName ? (
                    <span className="truncate text-muted-foreground">{row.guestFirstName}</span>
                  ) : null}
                </span>
                <time
                  dateTime={row.redeemedAt.toISOString()}
                  className="flex shrink-0 flex-col items-end text-muted-foreground tabular-nums"
                  suppressHydrationWarning
                >
                  <span>{day(row.redeemedAt)}</span>
                  <bdi dir="ltr" className="text-xs">
                    {clock(row.redeemedAt)}
                  </bdi>
                </time>
              </li>
            ))}
          </ul>
        ) : history.isPending ? null : (
          <p className="text-muted-foreground text-sm">{history.isError ? tList("failed") : t("noRecent")}</p>
        )}
        <LoadMore query={history} shown={rows.length} total={stats.data?.total} />
      </Section>
    </div>
  )
}
