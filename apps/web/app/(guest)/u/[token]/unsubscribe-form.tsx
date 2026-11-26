"use client"

import { buttonVariants } from "@ritorno/ui/components/button"
import { CircleAlertIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { ConsentToggle } from "@/components/consent-toggle"
import { type ChannelStates, setChannel, stopAll } from "./actions"

interface Props {
  token: string
  initial: ChannelStates
  wording: Record<string, string>
  copy: {
    email: string
    whatsapp: string
    turnsOn: string
    stopAll: string
    stoppedTitle: string
    stopped: string
    saved: string
    error: string
  }
}

export function UnsubscribeForm({ token, initial, wording, copy }: Props) {
  const [states, setStates] = useState<ChannelStates>(initial)
  const [note, setNote] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, startTransition] = useTransition()
  const anyOn = states.some((state) => state.granted)

  const apply = (call: Promise<ChannelStates | null>, previous: ChannelStates) =>
    startTransition(async () => {
      const next = await call
      setFailed(!next)
      if (!next) {
        setStates(previous)
        setNote(copy.error)
        return
      }
      setStates(next)
      setNote(next.some((state) => state.granted) ? copy.saved : null)
    })

  return (
    <div className="grid gap-4">
      <div className="grid gap-3">
        {states.map(({ channel, granted }) => (
          <ConsentToggle
            key={channel}
            title={copy[channel]}
            wording={granted ? (wording[channel] ?? "") : copy.turnsOn.replace("{wording}", wording[channel] ?? "")}
            checked={granted}
            disabled={busy}
            onChange={(event) => {
              const previous = states
              setStates(
                states.map((state) =>
                  state.channel === channel ? { ...state, granted: event.target.checked } : state,
                ),
              )
              apply(setChannel(token, channel, event.target.checked), previous)
            }}
          />
        ))}
      </div>
      {anyOn ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const previous = states
            setStates(states.map((state) => ({ ...state, granted: false })))
            apply(stopAll(token), previous)
          }}
          className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full" })}
        >
          {copy.stopAll}
        </button>
      ) : (
        <div role="status" className="grid gap-1 rounded-card border bg-surface p-4">
          <strong className="font-semibold">{copy.stoppedTitle}</strong>
          <span className="text-muted-foreground text-sm">{copy.stopped}</span>
        </div>
      )}
      <p
        role={failed ? "alert" : "status"}
        className="flex min-h-5 items-center gap-1.5 text-sm data-[failed=true]:text-destructive"
        data-failed={failed}
      >
        {failed ? <CircleAlertIcon aria-hidden className="size-4 shrink-0" /> : null}
        {note}
      </p>
    </div>
  )
}
