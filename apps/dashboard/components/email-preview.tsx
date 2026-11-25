"use client"

import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { Card, CardContent } from "@ritorno/ui/components/card"
import { Tabs, TabsList, TabsTrigger } from "@ritorno/ui/components/tabs"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

const TEMPLATES = ["welcome", "birthday", "survey", "reminder"] as const
const LANGUAGES = ["en", "fr", "ar"] as const
type Template = (typeof TEMPLATES)[number]
type Language = (typeof LANGUAGES)[number]
type Appearance = "light" | "dark"
type Width = "desktop" | "mobile"

const FRAME_WIDTH: Record<Width, string> = { desktop: "w-160", mobile: "w-94" }

export interface EmailPreviewLabels {
  template: string
  language: string
  appearance: string
  width: string
  light: string
  dark: string
  desktop: string
  mobile: string
  sendTest: string
  sending: string
  sentTo: string
  notSent: string
  loading: string
  subject: string
  frameTitle: string
  templates: Record<Template, string>
  languages: Record<Language, string>
}

/** The email carries its dark mode in a media query, so the preview turns it on or off by rewriting the query. */
const forAppearance = (html: string, appearance: Appearance): string =>
  html.replaceAll("@media (prefers-color-scheme: dark)", appearance === "dark" ? "@media all" : "@media not all")

function Choice<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: Value
  options: { value: Value; label: string }[]
  onChange: (value: Value) => void
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <Tabs value={value} onValueChange={(next) => onChange(next as Value)}>
        <TabsList className="h-11 max-w-full flex-wrap">
          {options.map((option) => (
            <TabsTrigger key={option.value} value={option.value} className="min-h-9 px-3">
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}

export function EmailPreview({ defaultLanguage, labels }: { defaultLanguage: Language; labels: EmailPreviewLabels }) {
  const [template, setTemplate] = useState<Template>("welcome")
  const [language, setLanguage] = useState<Language>(defaultLanguage)
  const [appearance, setAppearance] = useState<Appearance>("light")
  const [width, setWidth] = useState<Width>("mobile")
  const preview = useQuery(orpc.emails.preview.queryOptions({ input: { template, locale: language } }))
  const sendTest = useMutation(
    orpc.emails.sendTest.mutationOptions({
      onSuccess: ({ sent, to }) =>
        sent ? toast.success(labels.sentTo.replace("{email}", to)) : toast.info(labels.notSent),
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <Choice
          label={labels.template}
          value={template}
          onChange={setTemplate}
          options={TEMPLATES.map((value) => ({ value, label: labels.templates[value] }))}
        />
        <Choice
          label={labels.language}
          value={language}
          onChange={setLanguage}
          options={LANGUAGES.map((value) => ({ value, label: labels.languages[value] }))}
        />
        <Choice
          label={labels.appearance}
          value={appearance}
          onChange={setAppearance}
          options={[
            { value: "light", label: labels.light },
            { value: "dark", label: labels.dark },
          ]}
        />
        <Choice
          label={labels.width}
          value={width}
          onChange={setWidth}
          options={[
            { value: "desktop", label: labels.desktop },
            { value: "mobile", label: labels.mobile },
          ]}
        />
        <Button
          className="min-h-11"
          disabled={sendTest.isPending}
          onClick={() => sendTest.mutate({ template, locale: language })}
        >
          {sendTest.isPending ? labels.sending : labels.sendTest}
        </Button>
      </div>
      <Card>
        <CardContent className="grid gap-3">
          <p className="text-sm" aria-live="polite">
            <span className="text-muted-foreground">{labels.subject}: </span>
            {preview.data?.subject ?? labels.loading}
          </p>
          <div className="overflow-x-auto bg-muted p-3">
            <iframe
              title={labels.frameTitle}
              sandbox=""
              srcDoc={preview.data ? forAppearance(preview.data.html, appearance) : undefined}
              className={`mx-auto block h-180 max-w-full border-0 bg-white ${FRAME_WIDTH[width]}`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
