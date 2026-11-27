"use client"

import { STAY_MAX_NIGHTS } from "@ritorno/common/hotel-time"
import { Input } from "@ritorno/ui/components/input"
import { useState } from "react"
import { ConsentToggle } from "./consent-toggle"

export interface DepartureCopy {
  title: string
  optional: string
  nights: { nights: number; label: string }[]
  pick: string
  date: string
  dateError: string
  keep: string
  wording: string
}

const PILL =
  "min-h-11 rounded-full border bg-background px-4 font-medium text-sm transition-colors duration-150 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"

/** The day `nights` from now on the guest's phone, which is at the hotel. */
function dayAfter(nights: number) {
  const day = new Date()
  day.setDate(day.getDate() + nights)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

/** Optional "when do you leave?". Nothing is stored unless the guest also switches the consent on. */
export function DepartureField({
  copy,
  className,
  rejected,
}: {
  copy: DepartureCopy
  className?: string
  /** The api refused the date. */
  rejected?: boolean
}) {
  const [choice, setChoice] = useState<number | "date" | null>(null)
  const [picked, setPicked] = useState("")
  const toggle = (next: number | "date") => setChoice((current) => (current === next ? null : next))
  const outOfRange = choice === "date" && !!picked && (picked < dayAfter(0) || picked > dayAfter(STAY_MAX_NIGHTS))
  const value = typeof choice === "number" ? dayAfter(choice) : choice === "date" && !outOfRange ? picked : ""

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 font-medium text-sm">
        {copy.title} <span className="font-normal text-muted-foreground text-xs">{copy.optional}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {copy.nights.map(({ nights, label }) => (
          <button
            key={nights}
            type="button"
            aria-pressed={choice === nights}
            onClick={() => toggle(nights)}
            className={PILL}
          >
            {label}
          </button>
        ))}
        <button type="button" aria-pressed={choice === "date"} onClick={() => toggle("date")} className={PILL}>
          {copy.pick}
        </button>
      </div>
      {choice === "date" ? (
        <>
          <Input
            type="date"
            min={dayAfter(0)}
            max={dayAfter(STAY_MAX_NIGHTS)}
            aria-label={copy.date}
            aria-invalid={outOfRange}
            value={picked}
            onChange={(event) => setPicked(event.target.value)}
            className={className}
          />
        </>
      ) : null}
      {outOfRange || rejected ? (
        <p role="alert" className="text-destructive text-sm">
          {copy.dateError}
        </p>
      ) : null}
      <input type="hidden" name="stayCheckOut" value={value} />
      {value ? <ConsentToggle name="stayConsent" title={copy.keep} wording={copy.wording} /> : null}
    </fieldset>
  )
}
