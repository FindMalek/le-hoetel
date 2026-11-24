"use client"

import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { Switch } from "@le-hoetel/ui/components/switch"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

type Channel = "email" | "whatsapp"
type States = { channel: Channel; granted: boolean }[]

interface Props {
  token: string
  initial: States
  wording: Record<string, string>
  copy: {
    email: string
    whatsapp: string
    stopAll: string
    stoppedTitle: string
    stopped: string
    saved: string
    error: string
  }
}

export function UnsubscribeForm({ token, initial, wording, copy }: Props) {
  const [states, setStates] = useState<States>(initial)
  const [note, setNote] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const handlers = {
    onSuccess: (next: States) => {
      setStates(next)
      setFailed(false)
      setNote(next.some((state) => state.granted) ? copy.saved : copy.stopped)
    },
    onError: () => {
      setFailed(true)
      setNote(copy.error)
    },
  }
  const update = useMutation(orpc.public.unsubscribe.update.mutationOptions(handlers))
  const stopAll = useMutation(orpc.public.unsubscribe.all.mutationOptions(handlers))
  const busy = update.isPending || stopAll.isPending
  const anyOn = states.some((state) => state.granted)

  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {states.map(({ channel, granted }) => {
          const id = `channel-${channel}`
          return (
            <li key={channel} className="grid gap-1">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={id} className="font-medium text-base">
                  {copy[channel]}
                </label>
                <Switch
                  id={id}
                  checked={granted}
                  disabled={busy}
                  onCheckedChange={(checked) => update.mutate({ token, [channel]: checked })}
                />
              </div>
              {!granted ? <p className="text-muted-foreground text-xs">{wording[channel]}</p> : null}
            </li>
          )
        })}
      </ul>
      {anyOn ? (
        <Button
          size="lg"
          variant="outline"
          className="min-h-11"
          disabled={busy}
          onClick={() => stopAll.mutate({ token })}
        >
          {copy.stopAll}
        </Button>
      ) : null}
      <p role={failed ? "alert" : "status"} className={failed ? "text-destructive text-sm" : "text-sm"}>
        {!anyOn ? <strong className="block">{copy.stoppedTitle}</strong> : null}
        {note}
      </p>
    </div>
  )
}
