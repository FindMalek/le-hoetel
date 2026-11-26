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
import { Badge } from "@ritorno/ui/components/badge"
import { Button } from "@ritorno/ui/components/button"
import { Checkbox } from "@ritorno/ui/components/checkbox"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Label } from "@ritorno/ui/components/label"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { cn } from "@ritorno/ui/lib/utils"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DownloadIcon, FileSpreadsheetIcon, UploadIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { LanguageChoice } from "@/components/language-choice"
import { download } from "@/lib/download"

const FIELDS = ["name", "phone", "email", "birthday", "language", "consent"] as const
type ImportField = (typeof FIELDS)[number]
type Mapping = Record<ImportField, number>
type Step = "upload" | "map" | "review" | "done"

const REQUIRED: ImportField[] = ["name", "phone"]
const STEPS = ["upload", "map", "review"] as const
const PROBLEM_FIELDS = ["name", "phone", "email", "birthday", "language"] as const

const GUESSES: Record<ImportField, string[]> = {
  name: ["name", "nom", "full", "client", "guest", "اسم"],
  phone: ["phone", "tel", "mobile", "gsm", "whatsapp", "هاتف"],
  email: ["mail", "courriel", "بريد"],
  birthday: ["birth", "naissance", "anniv", "ميلاد"],
  language: ["lang", "langue", "لغة"],
  consent: ["consent", "opt", "accord"],
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
  const mapping = Object.fromEntries(FIELDS.map((field) => [field, find(field)])) as Mapping
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

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface md:text-sm"

export function GuestImport({ defaultLanguage }: { defaultLanguage: HotelLanguage }) {
  const t = useTranslations("guests.import")
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
  const consentMapped = mapping ? mapping.consent >= 0 : false
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
    for (const row of rows) {
      const parsed = guestCreateSchema.safeParse(
        guestFromImportRow(row, { defaultLanguage: language, confirmConsent: true }),
      )
      if (parsed.success) {
        valid++
        if (parsed.data.consents.email || parsed.data.consents.whatsapp) consenting++
      } else {
        problems.push({ line: row.line, field: problemOf(parsed.error.issues[0]?.path.join(".") ?? "") })
      }
    }
    return { valid, consenting, problems }
  }, [rows, language])

  const send = useMutation(
    orpc.guests.import.mutationOptions({
      onSuccess: (data) => {
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
      ["name", "phone", "email", "language", "consent"],
      ["Amel Ben Salah", "+216 20 123 456", "amel@example.com", "fr", "yes"],
      ["John Miller", "+44 7700 900123", "", "en", "no"],
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
                <div key={field} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={`map-${field}`}>{t(`field.${field}`)}</Label>
                    <span className="flex items-center gap-2">
                      {auto && <Badge variant="secondary">{t("detected")}</Badge>}
                      {REQUIRED.includes(field) ? (
                        <Badge variant="outline">{t("required")}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">{t("optional")}</span>
                      )}
                    </span>
                  </div>
                  <select
                    id={`map-${field}`}
                    className={selectClass}
                    value={mapping[field]}
                    onChange={(event) => setMapping({ ...mapping, [field]: Number(event.target.value) })}
                  >
                    <option value={-1}>{t("none")}</option>
                    {headers.map((header, index) => (
                      <option key={index} value={index}>
                        {header}
                      </option>
                    ))}
                  </select>
                  {examples.length > 0 && (
                    <p dir="ltr" className="truncate text-start text-muted-foreground text-xs">
                      {examples.join("  ·  ")}
                    </p>
                  )}
                </div>
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
            {t("result", { created: result.created, merged: result.merged, failed: result.errors.length })}
            {result.consentKept > 0 && <> {t("consentKept", { count: result.consentKept })}</>}
          </InlineAlert>
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
