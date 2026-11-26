"use client"

import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { Textarea } from "@ritorno/ui/components/textarea"
import { useMutation } from "@tanstack/react-query"
import { MessageSquareIcon } from "lucide-react"
import { useState } from "react"

/** A small button bottom left that opens a form and files the answer as a GitHub issue. */
export function FeedbackButton({
  labels,
}: {
  labels: Record<"open" | "description" | "placeholder" | "send" | "cancel" | "thanks" | "error", string>
}) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("")
  const [note, setNote] = useState<string | null>(null)
  const send = useMutation(
    orpc.feedback.send.mutationOptions({
      onSuccess: () => {
        setNote(labels.thanks)
        setMessage("")
        setOpen(false)
      },
      onError: () => setNote(labels.error),
    }),
  )

  return (
    <div className="fixed end-4 bottom-[calc(1rem+var(--consent-banner-height,0px))] z-40">
      {open ? (
        <form
          className="grid w-72 gap-2 rounded-lg border bg-card p-3 shadow-lg"
          onSubmit={(event) => {
            event.preventDefault()
            setNote(null)
            send.mutate({ message, website, page: window.location.pathname })
          }}
        >
          <p id="feedback-description" className="text-muted-foreground text-xs">
            {labels.description}
          </p>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            aria-describedby="feedback-description"
            maxLength={2000}
          />
          <input
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="sr-only"
            name="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
          {note && (
            <p role="alert" className="text-destructive text-xs">
              {note}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {labels.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={send.isPending || message.trim().length < 5}>
              {labels.send}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setNote(null)
              setOpen(true)
            }}
          >
            <MessageSquareIcon /> {labels.open}
          </Button>
          <span role="status" className="text-muted-foreground text-xs">
            {note}
          </span>
        </div>
      )}
    </div>
  )
}
