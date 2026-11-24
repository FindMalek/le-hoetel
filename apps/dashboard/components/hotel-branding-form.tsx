"use client"

import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@le-hoetel/ui/components/card"
import { FieldGroup } from "@le-hoetel/ui/components/field"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import type { FormEvent } from "react"
import { toast } from "sonner"
import { ColorField, type ColorLabels } from "./color-field"

interface Labels extends ColorLabels {
  title: string
  primaryColor: string
  accentColor: string
  save: string
  saved: string
}

export function HotelBrandingForm({
  primaryColor,
  accentColor,
  labels,
}: {
  primaryColor: string | null
  accentColor: string | null
  labels: Labels
}) {
  const router = useRouter()
  const update = useMutation(
    orpc.hotel.update.mutationOptions({
      onSuccess: () => {
        toast.success(labels.saved)
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    update.mutate({
      primaryColor: String(data.get("primaryColor") ?? "").trim() || null,
      accentColor: String(data.get("accentColor") ?? "").trim() || null,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            <ColorField
              name="primaryColor"
              label={labels.primaryColor}
              placeholder="#0a7c66"
              defaultValue={primaryColor}
              labels={labels}
            />
            <ColorField
              name="accentColor"
              label={labels.accentColor}
              placeholder="#f2b134"
              defaultValue={accentColor}
              labels={labels}
            />
            <Button type="submit" disabled={update.isPending}>
              {labels.save}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
