"use client"

import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ritorno/ui/components/dialog"
import { Input } from "@ritorno/ui/components/input"
import { Textarea } from "@ritorno/ui/components/textarea"
import { useMutation } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { toast } from "sonner"

const OPEN_EVENT = "open-feedback"

export const openFeedback = (): void => {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/** Mounted once in the shell; the sidebar footer and the phone "More" sheet open it, so it never floats over content. */
export function FeedbackDialog() {
  const t = useTranslations("shell")
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const send = useMutation(
    orpc.feedback.send.mutationOptions({
      onSuccess: () => {
        toast.success(t("feedbackThanks"))
        setMessage("")
        setOpen(false)
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            send.mutate({ message, email, website, page: window.location.pathname })
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("feedbackTitle")}</DialogTitle>
            <DialogDescription>{t("feedbackDescription")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("feedbackPlaceholder")}
            aria-label={t("feedbackPlaceholder")}
            rows={4}
          />
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("feedbackEmail")}
            aria-label={t("feedbackEmail")}
            dir="ltr"
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
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("feedbackCancel")}
            </Button>
            <Button type="submit" disabled={send.isPending || message.trim().length < 5}>
              {t("feedbackSend")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
