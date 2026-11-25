"use client"

import { parseCsv, toCsv } from "@le-hoetel/common/csv"
import { HOTEL_LANGUAGES, type HotelLanguage } from "@le-hoetel/common/hotel"
import {
  GUEST_IMPORT_MAX_BYTES,
  GUEST_IMPORT_MAX_ROWS,
  type GuestImportResult,
  type GuestImportRow,
} from "@le-hoetel/common/schemas"
import { LOCALE_NAMES } from "@le-hoetel/i18n"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Alert, AlertDescription } from "@le-hoetel/ui/components/alert"
import { Button } from "@le-hoetel/ui/components/button"
import { Checkbox } from "@le-hoetel/ui/components/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@le-hoetel/ui/components/field"
import { Input } from "@le-hoetel/ui/components/input"
import { Label } from "@le-hoetel/ui/components/label"
import { useMutation } from "@tanstack/react-query"
import { DownloadIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

const FIELDS = ["name", "phone", "email", "birthday", "language", "consent"] as const
type ImportField = (typeof FIELDS)[number]
type Mapping = Record<ImportField, number>

const GUESSES: Record<ImportField, string[]> = {
  name: ["name", "nom", "full", "اسم"],
  phone: ["phone", "tel", "mobile", "gsm", "هاتف"],
  email: ["mail", "courriel"],
  birthday: ["birth", "naissance"],
  language: ["lang"],
  consent: ["consent", "opt"],
}

const guessMapping = (headers: string[]): Mapping =>
  Object.fromEntries(
    FIELDS.map((field) => [
      field,
      headers.findIndex((header) => GUESSES[field].some((word) => header.toLowerCase().includes(word))),
    ]),
  ) as Mapping

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

type Result = GuestImportResult

export function GuestImport({ defaultLanguage }: { defaultLanguage: HotelLanguage }) {
  const t = useTranslations("guests.import")
  const [error, setError] = useState<string | null>(null)
  const [table, setTable] = useState<string[][] | null>(null)
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [language, setLanguage] = useState(defaultLanguage)
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const headers = table?.[0] ?? []
  const body = table?.slice(1) ?? []

  const send = useMutation(
    orpc.guests.import.mutationOptions({
      onSuccess: setResult,
      onError: (failure: Error) => setError(errorMessage(failure)),
    }),
  )

  async function pick(file: File | undefined) {
    setError(null)
    setResult(null)
    setTable(null)
    if (!file) return
    if (file.size > GUEST_IMPORT_MAX_BYTES) return setError(t("tooBig"))
    const parsed = parseCsv(await file.text())
    if (parsed.length < 2) return setError(t("empty"))
    if (parsed.length - 1 > GUEST_IMPORT_MAX_ROWS) return setError(t("tooMany", { rows: GUEST_IMPORT_MAX_ROWS }))
    setTable(parsed)
    setMapping(guessMapping(parsed[0] ?? []))
  }

  const ready = mapping && mapping.name >= 0 && mapping.phone >= 0
  const consentMapped = mapping ? mapping.consent >= 0 : false

  function run() {
    if (!mapping) return
    const cellOf = (row: string[], field: ImportField) => (mapping[field] >= 0 ? row[mapping[field]] : undefined)
    const rows: GuestImportRow[] = body.map((row, index) => ({
      line: index + 2,
      ...Object.fromEntries(FIELDS.map((field) => [field, cellOf(row, field)])),
    }))
    setError(null)
    send.mutate({ rows, defaultLanguage: language, confirmConsent: consentMapped && confirm })
  }

  function download(errors: Result["errors"]) {
    const rows = errors.map(({ line, message }) => [String(line), message, ...(table?.[line - 1] ?? [])])
    const report = toCsv([[t("lineColumn"), t("errorColumn"), ...headers], ...rows])
    const url = URL.createObjectURL(new Blob([`\uFEFF${report}`], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "import-errors.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  if (result) {
    return (
      <div className="grid max-w-xl gap-4">
        <Alert>
          <AlertDescription role="status">
            {t("result", { created: result.created, merged: result.merged, failed: result.errors.length })}
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          {result.errors.length > 0 && (
            <Button size="lg" className="h-11" onClick={() => download(result.errors)}>
              <DownloadIcon />
              {t("download")}
            </Button>
          )}
          <Button variant="outline" className="h-11" onClick={() => void pick(undefined)}>
            {t("another")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <FieldGroup className="max-w-xl">
      <Field>
        <FieldLabel htmlFor="import-file">{t("file")}</FieldLabel>
        <Input
          id="import-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void pick(event.target.files?.[0])}
        />
        <FieldDescription>
          {t("fileHint", { rows: GUEST_IMPORT_MAX_ROWS, mb: GUEST_IMPORT_MAX_BYTES / 1_000_000 })}
        </FieldDescription>
      </Field>
      {error && (
        <Alert variant="destructive">
          <AlertDescription role="alert">{error}</AlertDescription>
        </Alert>
      )}
      {table && mapping && (
        <>
          <p className="text-muted-foreground text-sm">{t("rows", { count: body.length })}</p>
          <h2 className="font-heading font-medium">{t("mapTitle")}</h2>
          {FIELDS.map((field) => (
            <Field key={field}>
              <FieldLabel htmlFor={`map-${field}`}>{t(`field.${field}`)}</FieldLabel>
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
            </Field>
          ))}
          <Field>
            <FieldLabel htmlFor="import-language">{t("defaultLanguage")}</FieldLabel>
            <select
              id="import-language"
              className={selectClass}
              value={language}
              onChange={(event) => setLanguage(event.target.value as HotelLanguage)}
            >
              {HOTEL_LANGUAGES.map((value) => (
                <option key={value} value={value}>
                  {LOCALE_NAMES[value]}
                </option>
              ))}
            </select>
          </Field>
          {consentMapped && (
            <div className="flex items-start gap-3 text-sm">
              <Checkbox id="import-confirm" className="mt-0.5" checked={confirm} onCheckedChange={setConfirm} />
              <Label htmlFor="import-confirm" className="grid gap-1 font-normal">
                <span className="font-medium">{t("confirm")}</span>
                <span className="text-muted-foreground">{t("confirmHint")}</span>
              </Label>
            </div>
          )}
          {!ready && <p className="text-muted-foreground text-sm">{t("needColumns")}</p>}
          <Button size="lg" className="h-12" disabled={!ready || send.isPending} onClick={run}>
            {send.isPending ? t("importing") : t("submit", { count: body.length })}
          </Button>
        </>
      )}
    </FieldGroup>
  )
}
