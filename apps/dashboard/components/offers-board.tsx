"use client"

import { type OfferState, offerState } from "@le-hoetel/common/offers"
import { OFFER_TEXT_MAX, OFFER_TITLE_MAX, type Offer } from "@le-hoetel/common/schemas"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@le-hoetel/ui/components/alert-dialog"
import { Badge } from "@le-hoetel/ui/components/badge"
import { Button } from "@le-hoetel/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@le-hoetel/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@le-hoetel/ui/components/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@le-hoetel/ui/components/field"
import { Input } from "@le-hoetel/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@le-hoetel/ui/components/sheet"
import { Switch } from "@le-hoetel/ui/components/switch"
import { Textarea } from "@le-hoetel/ui/components/textarea"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"
import { OfferPreview, type PreviewLabels } from "./offer-preview"

export interface OffersLabels {
  add: string
  empty: string
  emptyHint: string
  edit: string
  remove: string
  removeTitle: string
  removeBody: string
  cancel: string
  save: string
  saved: string
  removed: string
  formNew: string
  formEdit: string
  formHint: string
  fieldTitle: string
  fieldText: string
  fieldCode: string
  fieldCodeHint: string
  fieldTrigger: string
  fieldFrom: string
  fieldUntil: string
  fieldUntilHint: string
  fieldMax: string
  fieldMaxHint: string
  fieldActive: string
  triggerNone: string
  triggerWelcome: string
  triggerBirthday: string
  triggerManual: string
  redeemed: string
  redeemedOf: string
  forever: string
  until: string
  state: Record<OfferState, string>
  preview: PreviewLabels
}

type Trigger = Offer["trigger"]

const TRIGGERS = ["welcome", "birthday", "manual"] as const

const dayInput = (date: Date | null) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : ""

const startOfDay = (value: string) => new Date(`${value}T00:00:00`)
const endOfDay = (value: string) => new Date(`${value}T23:59:59`)

interface Draft {
  title: string
  text: string
  promoCode: string
  trigger: Trigger
  validFrom: string
  validUntil: string
  maxRedemptions: string
  active: boolean
}

const blank = (): Draft => ({
  title: "",
  text: "",
  promoCode: "",
  trigger: null,
  validFrom: dayInput(new Date()),
  validUntil: "",
  maxRedemptions: "",
  active: true,
})

const draftOf = (offer: Offer): Draft => ({
  title: offer.title,
  text: offer.text,
  promoCode: offer.promoCode,
  trigger: offer.trigger,
  validFrom: dayInput(offer.validFrom),
  validUntil: dayInput(offer.validUntil),
  maxRedemptions: offer.maxRedemptions === null ? "" : String(offer.maxRedemptions),
  active: offer.active,
})

const SELECT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

function OfferForm({
  offer,
  hotelName,
  labels,
  onDone,
}: {
  offer: Offer | null
  hotelName: string
  labels: OffersLabels
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>(offer ? draftOf(offer) : blank())
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const done = () => {
    toast.success(labels.saved)
    queryClient.invalidateQueries({ queryKey: orpc.offers.key() })
    onDone()
  }
  const onError = (error: Error) => toast.error(errorMessage(error))
  const create = useMutation(orpc.offers.create.mutationOptions({ onSuccess: done, onError }))
  const update = useMutation(orpc.offers.update.mutationOptions({ onSuccess: done, onError }))
  const busy = create.isPending || update.isPending

  function submit(event: FormEvent) {
    event.preventDefault()
    const input = {
      title: draft.title,
      text: draft.text,
      promoCode: draft.promoCode,
      trigger: draft.trigger,
      validFrom: draft.validFrom ? startOfDay(draft.validFrom) : undefined,
      validUntil: draft.validUntil ? endOfDay(draft.validUntil) : null,
      maxRedemptions: draft.maxRedemptions ? Number(draft.maxRedemptions) : null,
      active: draft.active,
    }
    if (offer) update.mutate({ id: offer.id, ...input })
    else create.mutate(input)
  }

  const triggerLabels: Record<(typeof TRIGGERS)[number], string> = {
    welcome: labels.triggerWelcome,
    birthday: labels.triggerBirthday,
    manual: labels.triggerManual,
  }

  return (
    <form onSubmit={submit} className="grid gap-6 overflow-y-auto px-4 pb-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="offer-title">{labels.fieldTitle}</FieldLabel>
          <Input
            id="offer-title"
            required
            maxLength={OFFER_TITLE_MAX}
            value={draft.title}
            onChange={(event) => set("title", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="offer-text">{labels.fieldText}</FieldLabel>
          <Textarea
            id="offer-text"
            rows={3}
            maxLength={OFFER_TEXT_MAX}
            value={draft.text}
            onChange={(event) => set("text", event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="offer-code">{labels.fieldCode}</FieldLabel>
          <Input
            id="offer-code"
            required
            dir="ltr"
            autoCapitalize="characters"
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,23}"
            value={draft.promoCode}
            onChange={(event) => set("promoCode", event.target.value.toUpperCase())}
          />
          <FieldDescription>{labels.fieldCodeHint}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="offer-trigger">{labels.fieldTrigger}</FieldLabel>
          <select
            id="offer-trigger"
            className={SELECT_CLASS}
            value={draft.trigger ?? ""}
            onChange={(event) => set("trigger", (event.target.value || null) as Trigger)}
          >
            <option value="">{labels.triggerNone}</option>
            {TRIGGERS.map((value) => (
              <option key={value} value={value}>
                {triggerLabels[value]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="offer-from">{labels.fieldFrom}</FieldLabel>
            <Input
              id="offer-from"
              type="date"
              required
              value={draft.validFrom}
              onChange={(event) => set("validFrom", event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="offer-until">{labels.fieldUntil}</FieldLabel>
            <Input
              id="offer-until"
              type="date"
              min={draft.validFrom}
              value={draft.validUntil}
              onChange={(event) => set("validUntil", event.target.value)}
            />
            <FieldDescription>{labels.fieldUntilHint}</FieldDescription>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="offer-max">{labels.fieldMax}</FieldLabel>
          <Input
            id="offer-max"
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            value={draft.maxRedemptions}
            onChange={(event) => set("maxRedemptions", event.target.value)}
          />
          <FieldDescription>{labels.fieldMaxHint}</FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <Switch id="offer-active" checked={draft.active} onCheckedChange={(checked) => set("active", checked)} />
          <FieldLabel htmlFor="offer-active">{labels.fieldActive}</FieldLabel>
        </Field>
      </FieldGroup>
      <OfferPreview
        hotelName={hotelName}
        labels={labels.preview}
        offer={{
          title: draft.title,
          text: draft.text,
          validFrom: draft.validFrom ? startOfDay(draft.validFrom).toLocaleDateString() : "",
          validUntil: draft.validUntil ? endOfDay(draft.validUntil).toLocaleDateString() : "",
        }}
      />
      <SheetFooter className="p-0">
        <Button type="submit" size="lg" disabled={busy}>
          {labels.save}
        </Button>
      </SheetFooter>
    </form>
  )
}

export function OffersBoard({ hotelName, labels }: { hotelName: string; labels: OffersLabels }) {
  const queryClient = useQueryClient()
  const { data: offers } = useSuspenseQuery(orpc.offers.list.queryOptions())
  const [editing, setEditing] = useState<Offer | "new" | null>(null)
  const [removing, setRemoving] = useState<Offer | null>(null)
  const remove = useMutation(
    orpc.offers.delete.mutationOptions({
      onSuccess: () => {
        toast.success(labels.removed)
        setRemoving(null)
        return queryClient.invalidateQueries({ queryKey: orpc.offers.key() })
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const now = new Date()

  return (
    <div className="grid gap-4 p-4 md:p-6">
      <div>
        <Button size="lg" onClick={() => setEditing("new")}>
          <PlusIcon data-icon="inline-start" />
          {labels.add}
        </Button>
      </div>
      {offers.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{labels.empty}</EmptyTitle>
            <EmptyDescription>{labels.emptyHint}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {offers.map((offer) => {
            const state = offerState(offer, offer.redeemed, now)
            return (
              <li key={offer.id}>
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words">{offer.title}</span>
                      <Badge variant={state === "ready" ? "secondary" : "outline"}>{labels.state[state]}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm">
                    {offer.text ? <p className="text-muted-foreground">{offer.text}</p> : null}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <bdi dir="ltr" className="font-mono font-semibold tracking-wider">
                        {offer.promoCode}
                      </bdi>
                      <span className="text-muted-foreground">
                        {(offer.maxRedemptions === null ? labels.redeemed : labels.redeemedOf)
                          .replace("{count}", String(offer.redeemed))
                          .replace("{max}", String(offer.maxRedemptions ?? ""))}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      {offer.validUntil
                        ? labels.until.replace("{date}", offer.validUntil.toLocaleDateString())
                        : labels.forever}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setEditing(offer)}>
                        <PencilIcon data-icon="inline-start" />
                        {labels.edit}
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={labels.remove} onClick={() => setRemoving(offer)}>
                        <Trash2Icon />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing === "new" ? labels.formNew : labels.formEdit}</SheetTitle>
            <SheetDescription>{labels.formHint}</SheetDescription>
          </SheetHeader>
          {editing ? (
            <OfferForm
              key={editing === "new" ? "new" : editing.id}
              offer={editing === "new" ? null : editing}
              hotelName={hotelName}
              labels={labels}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.removeTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {labels.removeBody.replace("{title}", removing?.title ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => removing && remove.mutate({ id: removing.id })}
            >
              {labels.remove}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
