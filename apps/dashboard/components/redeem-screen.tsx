"use client"

import { OFFER_CODE_MAX, type OfferLookup } from "@ritorno/common/schemas"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { Input } from "@ritorno/ui/components/input"
import { Label } from "@ritorno/ui/components/label"
import { Section } from "@ritorno/ui/components/section"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { cn } from "@ritorno/ui/lib/utils"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CameraIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { type FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"
import { LocalDate } from "./local-date"
import { canScanQr, QrScanner } from "./qr-scanner"

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

export function RedeemScreen() {
  const t = useTranslations("redeem")
  const queryClient = useQueryClient()
  const stats = useQuery(orpc.offers.redemptionStats.queryOptions())
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
        return queryClient.invalidateQueries({ queryKey: orpc.offers.redemptionStats.key() })
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
    const good = result.status === "ready" || done
    const Icon = good ? CheckCircle2Icon : XCircleIcon
    return (
      <div className="flex flex-col gap-6">
        <div
          role={good ? "status" : "alert"}
          className={cn(
            "flex min-h-[45dvh] flex-col items-center justify-center gap-5 rounded-3xl p-8 text-center md:min-h-80",
            good ? "bg-primary text-primary-foreground" : "bg-destructive text-background",
          )}
        >
          <Icon className="size-28 md:size-24" strokeWidth={1.5} aria-hidden />
          <p className="text-balance font-heading font-semibold text-3xl leading-tight tracking-tight md:text-4xl">
            {done ? t("justNow") : t(`status.${result.status}`)}
          </p>
          {result.offer ? <p className="text-balance text-xl opacity-90">{result.offer.title}</p> : null}
        </div>

        <dl className="grid gap-4 text-base">
          {result.offer?.text ? <p className="text-muted-foreground">{result.offer.text}</p> : null}
          {result.guestFirstName ? (
            <div className="flex items-baseline justify-between gap-4 border-b pb-3">
              <dt className="text-muted-foreground">{t("guest")}</dt>
              <dd className="font-semibold text-xl">{result.guestFirstName}</dd>
            </div>
          ) : null}
          {result.offer ? (
            <div className="flex items-baseline justify-between gap-4 border-b pb-3">
              <dt className="text-muted-foreground">{t("validUntil")}</dt>
              <dd>{result.offer.validUntil ? <LocalDate value={result.offer.validUntil} /> : t("noEnd")}</dd>
            </div>
          ) : null}
          {result.redeemed ? (
            <div className="flex items-baseline justify-between gap-4 border-b pb-3">
              <dt className="text-muted-foreground">{t("redeemedAt")}</dt>
              <dd className="text-end">
                <LocalDate value={result.redeemed.at} time />
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
        <div className="relative isolate aspect-[4/5] w-full overflow-hidden rounded-3xl bg-muted md:aspect-video">
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
        {stats.data?.recent.length ? (
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {stats.data.recent.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{row.offerTitle}</span>
                  {row.guestFirstName ? (
                    <span className="truncate text-muted-foreground">{row.guestFirstName}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  <LocalDate value={row.redeemedAt} time />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t("noRecent")}</p>
        )}
      </Section>
    </div>
  )
}
