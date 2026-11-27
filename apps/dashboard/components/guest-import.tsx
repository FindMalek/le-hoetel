"use client"

import { parseCsv, toCsv } from "@ritorno/common/csv"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { parsePhone } from "@ritorno/common/phone"
import {
  GUEST_IMPORT_MAX_BYTES,
  GUEST_IMPORT_MAX_ROWS,
  type GuestImportResult,
  type GuestImportRow,
  guestCreateSchema,
  guestFromImportRow,
} from "@ritorno/common/schemas"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { Checkbox } from "@ritorno/ui/components/checkbox"
import { DataTable } from "@ritorno/ui/components/data-table"
import { FormField } from "@ritorno/ui/components/form-field"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Label } from "@ritorno/ui/components/label"
import { Num } from "@ritorno/ui/components/num"
import { Select } from "@ritorno/ui/components/select"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { cn } from "@ritorno/ui/lib/utils"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DownloadIcon, FileSpreadsheetIcon, UploadIcon } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { LanguageChoice } from "@/components/language-choice"
import { download } from "@/lib/download"
import { useRefreshLists } from "@/lib/use-refresh-lists"

const FIELDS = [
  "name",
  "phone",
  "email",
  "birthday",
  "language",
  "consent",
  "stayCheckIn",
  "stayCheckOut",
  "stayConsent",
] as const
type ImportField = (typeof FIELDS)[number]
type Mapping = Record<ImportField, number>
type Step = "upload" | "map" | "review" | "done"

const REQUIRED: ImportField[] = ["name", "phone"]
const STEPS = ["upload", "map", "review"] as const
const PROBLEM_FIELDS = ["name", "phone", "email", "birthday", "language", "stayCheckIn", "stayCheckOut"] as const
const PREVIEW_FIELDS = ["name", "phone", "email", "language", "consent"] as const

const GUESSES: Record<ImportField, string[]> = {
  name: ["name", "nom", "full", "client", "guest", "اسم"],
  phone: ["phone", "tel", "mobile", "gsm", "whatsapp", "هاتف"],
  email: ["mail", "courriel", "بريد"],
  birthday: ["birth", "naissance", "anniv", "ميلاد"],
  language: ["lang", "langue", "لغة"],
  consent: ["consent", "opt", "accord"],
  stayCheckIn: ["arriv", "check-in", "check_in", "checkin", "وصول"],
  stayCheckOut: ["depart", "départ", "check-out", "check_out", "checkout", "مغادرة"],
  stayConsent: ["stay_consent", "stay consent", "consent_profile", "accord séjour", "الإقامة"],
}

const sample = (rows: string[][], column: number): string[] =>
  rows
    .map((row) => (row[column] ?? "").trim())
    .filter(Boolean)
    .slice(0, 5)

/** Header words first, then what the cells look like (numbers that parse as phones, cells with an @), for files without clear headers. */
function guessMapping(headers: string[], rows: string[][]): Mapping {
  const taken = new Set<number>()
  const find = (field: ImportField) => {
    const index = headers.findIndex(
      (header, at) => !taken.has(at) && GUESSES[field].some((word) => header.toLowerCase().includes(word)),
    )
    if (index >= 0) taken.add(index)
    return index
  }
  // The stay consent column first: its header also says "consent", which must not read as marketing consent.
  const order: ImportField[] = ["stayConsent", ...FIELDS.filter((field) => field !== "stayConsent")]
  const mapping = Object.fromEntries(order.map((field) => [field, find(field)])) as Mapping
  const byContent = (field: "phone" | "email", looksRight: (cell: string) => boolean) => {
    if (mapping[field] >= 0) return
    const index = headers.findIndex((_, at) => {
      const cells = sample(rows, at)
      return !taken.has(at) && cells.length > 0 && cells.filter(looksRight).length / cells.length >= 0.6
    })
    if (index >= 0) {
      taken.add(index)
      mapping[field] = index
    }
  }
  byContent("phone", (cell) => parsePhone(cell) !== null)
  byContent("email", (cell) => cell.includes("@"))
  return mapping
}

const problemOf = (message: string): (typeof PROBLEM_FIELDS)[number] | "row" => {
  const head = message.split(":")[0]?.split(".")[0] ?? ""
  return PROBLEM_FIELDS.find((field) => field === head) ?? "row"
}

export function GuestImport({ defaultLanguage }: { defaultLanguage: HotelLanguage }) {
  const t = useTranslations("guests.import")
  const locale = useLocale()
  const [step, setStep] = useState<Step>("upload")
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState("")
  const [table, setTable] = useState<string[][] | null>(null)
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [detected, setDetected] = useState<Mapping | null>(null)
  const [language, setLanguage] = useState(defaultLanguage)
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<GuestImportResult | null>(null)
  const [dragging, setDragging] = useState(false)

  const headers = table?.[0] ?? []
  const body = useMemo(() => table?.slice(1) ?? [], [table])
  const consentMapped = mapping ? mapping.consent >= 0 || mapping.stayConsent >= 0 : false
  const ready = mapping !== null && REQUIRED.every((field) => mapping[field] >= 0)

  const rows = useMemo<GuestImportRow[]>(() => {
    if (!mapping) return []
    return body.map((row, index) => ({
      line: index + 2,
      ...Object.fromEntries(FIELDS.map((field) => [field, mapping[field] >= 0 ? row[mapping[field]] : undefined])),
    }))
  }, [body, mapping])

  const review = useMemo(() => {
    const problems: { line: number; field: (typeof PROBLEM_FIELDS)[number] | "row" }[] = []
    let valid = 0
    let consenting = 0
    let datesDropped = 0
    for (const row of rows) {
      const parsed = guestCreateSchema.safeParse(
        guestFromImportRow(row, { defaultLanguage: language, confirmConsent: true }),
      )
      if (parsed.success) {
        valid++
        if (parsed.data.consents.email || parsed.data.consents.whatsapp) consenting++
        if (!parsed.data.consents.profile && (row.stayCheckIn?.trim() || row.stayCheckOut?.trim())) datesDropped++
      } else {
        problems.push({ line: row.line, field: problemOf(parsed.error.issues[0]?.path.join(".") ?? "") })
      }
    }
    return { valid, consenting, datesDropped, problems }
  }, [rows, language])

  const refreshLists = useRefreshLists()
  const send = useMutation(
    orpc.guests.import.mutationOptions({
      onSuccess: (data) => {
        void refreshLists()
        setResult(data)
        setStep("done")
      },
      onError: () => setError(t("failed")),
    }),
  )

  function reset() {
    setStep("upload")
    setError(null)
    setTable(null)
    setMapping(null)
    setResult(null)
    setConfirm(false)
    setFileName("")
  }

  async function pick(file: File | undefined) {
    setError(null)
    if (!file) return
    if (file.size > GUEST_IMPORT_MAX_BYTES) return setError(t("tooBig"))
    const parsed = parseCsv(await file.text()).filter((row) => row.some((cell) => cell.trim() !== ""))
    if (parsed.length < 2) return setError(t("empty"))
    if (parsed.length - 1 > GUEST_IMPORT_MAX_ROWS) return setError(t("tooMany", { rows: GUEST_IMPORT_MAX_ROWS }))
    const guessed = guessMapping(parsed[0] ?? [], parsed.slice(1))
    setTable(parsed)
    setFileName(file.name)
    setMapping(guessed)
    setDetected(guessed)
    setConfirm(false)
    setStep("map")
  }

  function run() {
    setError(null)
    send.mutate({ rows, defaultLanguage: language, confirmConsent: consentMapped && confirm })
  }

  function report(errors: { line: number; message: string }[]) {
    const lines = errors.map(({ line, message }) => [
      String(line),
      t(`problem.${problemOf(message)}`),
      ...(table?.[line - 1] ?? []),
    ])
    const csv = toCsv([[t("lineColumn"), t("errorColumn"), ...headers], ...lines])
    download("import-errors.csv", `\uFEFF${csv}`, "text/csv;charset=utf-8")
  }

  function downloadSample() {
    const csv = toCsv([
      ["name", "phone", "email", "language", "consent", "arrival", "departure", "stay_consent"],
      ["Amel Ben Salah", "+216 20 123 456", "amel@example.com", "fr", "yes", "2026-08-01", "2026-08-08", "yes"],
      ["John Miller", "+44 7700 900123", "", "en", "no", "", "", "no"],
    ])
    download("guests-sample.csv", csv, "text/csv;charset=utf-8")
  }

  const current = step === "done" ? STEPS.length : STEPS.indexOf(step)

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <ol className="flex items-center gap-2 text-sm" aria-label={t("steps.label")}>
        {STEPS.map((name, index) => (
          <li
            key={name}
            aria-current={index === current ? "step" : undefined}
            className={cn("flex items-center gap-2", index > current && "text-muted-foreground")}
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-xs tabular-nums",
                index < current && "border-primary bg-primary text-primary-foreground",
                index === current && "border-primary text-primary",
              )}
            >
              {index < current ? <CheckIcon className="size-3.5" aria-hidden /> : index + 1}
            </span>
            <span className={cn("font-medium", index !== current && "max-sm:sr-only")}>{t(`steps.${name}`)}</span>
            {index < STEPS.length - 1 && <span aria-hidden className="h-px w-4 bg-border sm:w-8" />}
          </li>
        ))}
      </ol>

      {error && (
        <InlineAlert tone="error" title={error}>
          {step === "upload" ? t("tryAnother") : t("tryAgain")}
        </InlineAlert>
      )}

      {step === "upload" && (
        <div className="flex flex-col gap-4">
          <label
            htmlFor="import-file"
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              void pick(event.dataTransfer.files[0])
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center transition-colors duration-150 has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-surface hover:bg-muted/50",
              dragging && "border-primary bg-muted/50",
            )}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              <UploadIcon className="size-5" aria-hidden />
            </span>
            <span className="font-medium">{t("choose")}</span>
            <span className="max-w-sm text-pretty text-muted-foreground text-sm">
              {t("fileHint", { rows: GUEST_IMPORT_MAX_ROWS, mb: GUEST_IMPORT_MAX_BYTES / 1_000_000 })}
            </span>
            <input
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void pick(event.target.files?.[0])}
            />
          </label>
          <Button variant="ghost" className="w-fit" onClick={downloadSample}>
            <DownloadIcon data-icon="inline-start" />
            {t("sample")}
          </Button>
        </div>
      )}

      {step === "map" && mapping && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
            <FileSpreadsheetIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex min-w-0 flex-col">
              <span dir="ltr" className="truncate text-start font-medium">
                {fileName}
              </span>
              <span className="text-muted-foreground">{t("rows", { count: body.length })}</span>
            </div>
          </div>
          <div>
            <h2 className="font-heading font-semibold text-lg">{t("mapTitle")}</h2>
            <p className="text-muted-foreground text-sm">{t("mapHint")}</p>
          </div>
          <div className="flex flex-col gap-5">
            {FIELDS.map((field) => {
              const examples = mapping[field] >= 0 ? sample(body, mapping[field]).slice(0, 3) : []
              const auto = detected !== null && detected[field] >= 0 && detected[field] === mapping[field]
              return (
                <FormField
                  key={field}
                  id={`map-${field}`}
                  required={REQUIRED.includes(field)}
                  optional={REQUIRED.includes(field) ? undefined : t("optional")}
                  label={
                    <>
                      {t(`field.${field}`)}
                      {auto && (
                        <StatusBadge tone="info" className="ms-1">
                          {t("detected")}
                        </StatusBadge>
                      )}
                    </>
                  }
                  hint={
                    examples.length > 0 ? (
                      <span dir="ltr" className="block truncate text-start">
                        {examples.join("  ·  ")}
                      </span>
                    ) : undefined
                  }
                >
                  {(aria) => (
                    <Select
                      {...aria}
                      value={String(mapping[field])}
                      onValueChange={(value) => setMapping({ ...mapping, [field]: Number(value) })}
                      options={[
                        { value: "-1", label: t("none") },
                        ...headers.map((header, index) => ({ value: String(index), label: header })),
                      ]}
                    />
                  )}
                </FormField>
              )
            })}
          </div>
          <LanguageChoice
            name="import-language"
            value={language}
            onChange={setLanguage}
            legend={t("defaultLanguage")}
          />
          {!ready && <InlineAlert tone="warning">{t("needColumns")}</InlineAlert>}
          <StickyFormActions>
            <Button size="lg" disabled={!ready} onClick={() => setStep("review")}>
              {t("continue")}
              <ArrowRightIcon data-icon="inline-end" className="rtl:rotate-180" />
            </Button>
            <Button variant="ghost" size="lg" onClick={reset}>
              <ArrowLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
              {t("back")}
            </Button>
          </StickyFormActions>
        </div>
      )}

      {step === "review" && mapping && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
              <span className="font-heading font-semibold text-3xl tabular-nums">{review.valid}</span>
              <span className="text-muted-foreground text-sm">{t("ready")}</span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border bg-card p-4">
              <span className="font-heading font-semibold text-3xl tabular-nums">{review.problems.length}</span>
              <span className="text-muted-foreground text-sm">{t("skipped")}</span>
            </div>
          </div>

          {review.problems.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="font-heading font-semibold">{t("problemsTitle")}</h2>
              <ul className="flex flex-col divide-y rounded-lg border bg-card text-sm">
                {review.problems.slice(0, 6).map((problem) => (
                  <li key={problem.line} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span>{t(`problem.${problem.field}`)}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {t("line", { line: problem.line })}
                    </span>
                  </li>
                ))}
              </ul>
              {review.problems.length > 6 && (
                <p className="text-muted-foreground text-sm">{t("more", { count: review.problems.length - 6 })}</p>
              )}
              <Button
                variant="ghost"
                className="w-fit"
                onClick={() =>
                  report(review.problems.map((problem) => ({ line: problem.line, message: problem.field })))
                }
              >
                <DownloadIcon data-icon="inline-start" />
                {t("download")}
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h2 className="font-heading font-semibold">{t("previewTitle")}</h2>
            <DataTable
              caption={t("previewTitle")}
              columns={PREVIEW_FIELDS.map((field) => ({
                id: field,
                header: t(`field.${field}`),
                showFrom: field === "email" || field === "consent" ? ("lg" as const) : undefined,
                cell: (row: GuestImportRow) => (
                  <span dir={field === "name" ? "auto" : "ltr"} className="block truncate">
                    {row[field] || "–"}
                  </span>
                ),
              }))}
              rows={rows.slice(0, 5)}
              getRowKey={(row) => String(row.line)}
              card={(row) => (
                <div className="flex min-w-0 flex-col gap-1 text-sm">
                  <span dir="auto" className="truncate font-medium">
                    {row.name || "–"}
                  </span>
                  <span dir="ltr" className="truncate text-start text-muted-foreground">
                    {[row.phone || "–", row.email, row.language, row.consent].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}
            />
            {rows.length > 5 && (
              <p className="text-muted-foreground text-sm">{t("previewMore", { count: rows.length - 5 })}</p>
            )}
          </div>

          {/* Dates need both the row's yes and the confirmation. */}
          {(review.datesDropped > 0 || (!confirm && rows.some((row) => row.stayCheckIn || row.stayCheckOut))) && (
            <InlineAlert tone="warning" title={t("datesDropped")} />
          )}

          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <h2 className="font-heading font-semibold">{t("consentTitle")}</h2>
            {consentMapped ? (
              <>
                <p className="text-muted-foreground text-sm">{t("consentFound", { count: review.consenting })}</p>
                <Label htmlFor="import-confirm" className="items-start gap-3 font-normal">
                  <Checkbox id="import-confirm" className="mt-0.5" checked={confirm} onCheckedChange={setConfirm} />
                  <span className="grid gap-1">
                    <span className="font-medium">{t("confirm")}</span>
                    <span className="text-muted-foreground text-sm">{t("confirmHint")}</span>
                  </span>
                </Label>
                {!confirm && review.consenting > 0 && <InlineAlert tone="info">{t("unconfirmed")}</InlineAlert>}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noConsentColumn")}</p>
            )}
          </div>

          <StickyFormActions>
            <Button size="lg" disabled={review.valid === 0} loading={send.isPending} onClick={run}>
              {t("submit", { count: review.valid })}
            </Button>
            <Button variant="ghost" size="lg" disabled={send.isPending} onClick={() => setStep("map")}>
              <ArrowLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
              {t("back")}
            </Button>
          </StickyFormActions>
        </div>
      )}

      {step === "done" && result && (
        <div className="flex flex-col gap-4">
          <InlineAlert tone={result.errors.length ? "warning" : "success"} title={t("doneTitle")}>
            {result.consentKept > 0 ? t("consentKept", { count: result.consentKept }) : null}
          </InlineAlert>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                ["created", result.created],
                ["merged", result.merged],
                ["failed", result.errors.length],
                ["kept", result.consentKept],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-1 rounded-lg border bg-card p-4">
                <dt className="order-last text-muted-foreground text-sm">{t(`summary.${key}`)}</dt>
                <dd className="font-semibold text-h2 tabular-nums">
                  <Num value={value} locale={locale} />
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" render={<Link href="/guests" />} nativeButton={false}>
              {t("viewGuests")}
            </Button>
            {result.errors.length > 0 && (
              <Button variant="outline" size="lg" onClick={() => report(result.errors)}>
                <DownloadIcon data-icon="inline-start" />
                {t("download")}
              </Button>
            )}
            <Button variant="ghost" size="lg" onClick={reset}>
              {t("another")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
