"use client"

import { OFFER_CODE_MAX, type OfferLookup } from "@le-hoetel/common/schemas"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@le-hoetel/ui/components/card"
import { Input } from "@le-hoetel/ui/components/input"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CameraIcon, CheckCircle2Icon, ScanLineIcon, XCircleIcon } from "lucide-react"
import { type FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"
import { LocalDate } from "./local-date"
import { canScanQr, QrScanner } from "./qr-scanner"

export interface RedeemLabels {
  scan: string
  stopScan: string
  scanLabel: string
  noCamera: string
  cameraFailed: string
  typeCode: string
  codePlaceholder: string
  check: string
  redeem: string
  redeeming: string
  next: string
  guest: string
  validUntil: string
  noEnd: string
  redeemedAt: string
  redeemedBy: string
  justNow: string
  today: string
  week: string
  total: string
  recent: string
  noRecent: string
  status: Record<OfferLookup["status"], string>
}

const GOOD = new Set<OfferLookup["status"]>(["ready"])

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardContent className="grid gap-1">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="font-semibold text-2xl tabular-nums">{value}</span>
      </CardContent>
    </Card>
  )
}

export function RedeemScreen({ labels }: { labels: RedeemLabels }) {
  const queryClient = useQueryClient()
  const stats = useQuery(orpc.offers.redemptionStats.queryOptions())
  const [scanning, setScanning] = useState(false)
  const [supported, setSupported] = useState(true)
  const [typed, setTyped] = useState("")
  const [code, setCode] = useState("")
  const [result, setResult] = useState<OfferLookup | null>(null)
  useEffect(() => setSupported(canScanQr()), [])

  const onError = (error: Error) => toast.error(errorMessage(error))
  const lookup = useMutation(orpc.offers.lookup.mutationOptions({ onSuccess: setResult, onError }))
  const redeem = useMutation(
    orpc.offers.redeem.mutationOptions({
      onSuccess: (done) => {
        setResult(done)
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

  const good = result ? GOOD.has(result.status) || (result.status === "redeemed" && result.justNow) : false

  return (
    <div className="grid max-w-xl gap-4 p-4 md:p-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={labels.today} value={stats.data?.today ?? 0} />
        <Stat label={labels.week} value={stats.data?.week ?? 0} />
        <Stat label={labels.total} value={stats.data?.total ?? 0} />
      </div>

      {result ? (
        <Card>
          <CardHeader>
            <div
              role={good ? "status" : "alert"}
              className={`flex items-center gap-2 rounded-lg p-3 font-medium ${good ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive"}`}
            >
              {good ? <CheckCircle2Icon aria-hidden /> : <XCircleIcon aria-hidden />}
              {result.status === "redeemed" && result.justNow ? labels.justNow : labels.status[result.status]}
            </div>
            {result.offer ? (
              <>
                <CardTitle className="text-xl">{result.offer.title}</CardTitle>
                {result.offer.text ? <CardDescription>{result.offer.text}</CardDescription> : null}
              </>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {result.guestFirstName ? (
              <p>
                <span className="text-muted-foreground">{labels.guest}: </span>
                <span className="font-medium">{result.guestFirstName}</span>
              </p>
            ) : null}
            {result.offer ? (
              <p className="text-muted-foreground">
                {result.offer.validUntil ? (
                  <>
                    {labels.validUntil}: <LocalDate value={result.offer.validUntil} />
                  </>
                ) : (
                  labels.noEnd
                )}
              </p>
            ) : null}
            {result.redeemed ? (
              <p>
                {labels.redeemedAt}: <LocalDate value={result.redeemed.at} time />
                {result.redeemed.by ? ` · ${labels.redeemedBy} ${result.redeemed.by}` : null}
              </p>
            ) : null}
            {result.status === "ready" ? (
              <Button
                size="lg"
                className="h-14 text-lg"
                disabled={redeem.isPending}
                onClick={() => redeem.mutate({ code })}
              >
                {redeem.isPending ? labels.redeeming : labels.redeem}
              </Button>
            ) : null}
            <Button variant="outline" size="lg" onClick={reset}>
              {labels.next}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="grid gap-4">
            {scanning ? (
              <QrScanner
                label={labels.scanLabel}
                onCode={check}
                onFail={() => {
                  setScanning(false)
                  toast.error(labels.cameraFailed)
                }}
              />
            ) : null}
            {supported ? (
              <Button size="lg" className="h-14 text-lg" onClick={() => setScanning((on) => !on)}>
                {scanning ? <ScanLineIcon data-icon="inline-start" /> : <CameraIcon data-icon="inline-start" />}
                {scanning ? labels.stopScan : labels.scan}
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">{labels.noCamera}</p>
            )}
            <form onSubmit={submit} className="grid gap-2">
              <label htmlFor="redeem-code" className="font-medium text-sm">
                {labels.typeCode}
              </label>
              <div className="flex gap-2">
                <Input
                  id="redeem-code"
                  dir="ltr"
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={OFFER_CODE_MAX}
                  placeholder={labels.codePlaceholder}
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                />
                <Button type="submit" size="lg" disabled={lookup.isPending || !typed.trim()}>
                  {labels.check}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-2">
        <h2 className="font-medium">{labels.recent}</h2>
        {stats.data?.recent.length ? (
          <ul className="grid gap-2">
            {stats.data.recent.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 border-b pb-2 text-sm">
                <span className="min-w-0 truncate">
                  <span className="font-medium">{row.offerTitle}</span>
                  {row.guestFirstName ? <span className="text-muted-foreground"> · {row.guestFirstName}</span> : null}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  <LocalDate value={row.redeemedAt} time />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{labels.noRecent}</p>
        )}
      </section>
    </div>
  )
}
