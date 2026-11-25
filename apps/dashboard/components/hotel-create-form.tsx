"use client"

import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@ritorno/ui/components/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@ritorno/ui/components/field"
import { Input } from "@ritorno/ui/components/input"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { type FormEvent, useRef } from "react"
import { toast } from "sonner"
import { ColorInput, type ColorLabels } from "./color-input"

interface Labels extends ColorLabels {
  title: string
  name: string
  slug: string
  ownerEmail: string
  ownerHint: string
  primaryColor: string
  accentColor: string
  language: string
  submit: string
  created: string
}

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export function HotelCreateForm({ labels }: { labels: Labels }) {
  const router = useRouter()
  const form = useRef<HTMLFormElement>(null)
  const slug = useRef<HTMLInputElement>(null)
  const create = useMutation(
    orpc.admin.hotels.create.mutationOptions({
      onSuccess: () => {
        form.current?.reset()
        toast.success(labels.created)
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const optional = (key: string) => String(data.get(key) ?? "").trim() || undefined
    create.mutate({
      name: String(data.get("name")),
      slug: String(data.get("slug")),
      ownerEmail: String(data.get("ownerEmail")),
      primaryColor: optional("primaryColor"),
      accentColor: optional("accentColor"),
      defaultLanguage: optional("defaultLanguage") as HotelLanguage | undefined,
    })
  }

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={form} onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">{labels.name}</FieldLabel>
              <Input
                id="name"
                name="name"
                required
                maxLength={80}
                onChange={(event) => {
                  if (slug.current) slug.current.value = slugOf(event.target.value)
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="slug">{labels.slug}</FieldLabel>
              <Input
                id="slug"
                name="slug"
                ref={slug}
                required
                maxLength={60}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                dir="ltr"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ownerEmail">{labels.ownerEmail}</FieldLabel>
              <Input id="ownerEmail" name="ownerEmail" type="email" required dir="ltr" />
              <FieldDescription>{labels.ownerHint}</FieldDescription>
            </Field>
            <ColorInput name="primaryColor" label={labels.primaryColor} placeholder="#0a7c66" labels={labels} />
            <ColorInput name="accentColor" label={labels.accentColor} placeholder="#f2b134" labels={labels} />
            <Field>
              <FieldLabel htmlFor="defaultLanguage">{labels.language}</FieldLabel>
              <select
                id="defaultLanguage"
                name="defaultLanguage"
                defaultValue="fr"
                className="h-11 w-full border border-input bg-background px-2.5 text-sm"
              >
                {HOTEL_LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {language.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" disabled={create.isPending}>
              {labels.submit}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
