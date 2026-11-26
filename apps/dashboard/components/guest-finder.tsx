"use client"

import { orpc } from "@ritorno/orpc/react"
import { Badge } from "@ritorno/ui/components/badge"
import { Button } from "@ritorno/ui/components/button"
import { Input } from "@ritorno/ui/components/input"
import { Skeleton } from "@ritorno/ui/components/skeleton"
import { useMutation, useQuery } from "@tanstack/react-query"
import { CheckIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { LocalDate } from "@/components/local-date"
import { useRefreshLists } from "@/lib/use-refresh-lists"

function useDebounced(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function GuestFinder() {
  const t = useTranslations("guests.finder")
  const tLang = useTranslations("home.languages")
  const [text, setText] = useState("")
  const q = useDebounced(text.trim())
  const enabled = q.length >= 2
  const found = useQuery({
    ...orpc.guests.find.queryOptions({ input: { q } }),
    enabled,
    placeholderData: (data) => data,
  })

  const refreshLists = useRefreshLists()
  const markVisit = useMutation(
    orpc.guests.markVisit.mutationOptions({
      onSuccess: () => {
        toast.success(t("marked"))
        void refreshLists()
      },
      onError: () => toast.error(t("error")),
    }),
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("placeholder")}
          aria-label={t("label")}
          autoComplete="off"
          enterKeyHint="search"
          className="h-11 ps-9"
        />
      </div>
      <div aria-live="polite" className="flex flex-col gap-3">
        {enabled && found.isPending && <Skeleton className="h-28 w-full" />}
        {enabled && found.isError && <p className="text-destructive text-sm">{t("error")}</p>}
        {enabled && found.data?.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {t("none")}{" "}
            <Link href="/guests/new" className="font-medium text-foreground underline underline-offset-4">
              {t("add")}
            </Link>
          </p>
        )}
        {enabled &&
          found.data?.map((guest) => (
            <article key={guest.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={`/guests/${guest.id}`}
                    className="truncate font-medium underline-offset-4 hover:underline"
                  >
                    {guest.name}
                  </Link>
                  <bdi dir="ltr" className="text-muted-foreground text-sm tabular-nums">
                    {guest.phoneE164}
                  </bdi>
                </div>
                <Button
                  size="lg"
                  disabled={markVisit.isPending && markVisit.variables?.id === guest.id}
                  onClick={() => markVisit.mutate({ id: guest.id })}
                >
                  <CheckIcon data-icon="inline-start" />
                  {t("markVisit")}
                </Button>
              </div>
              <p className="font-medium text-sm">
                {guest.visits >= 2 ? t("welcomeBack", { count: guest.visits }) : t("firstStay")}
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
                <Fact label={t("visits")}>
                  <span className="tabular-nums">{guest.visits}</span>
                </Fact>
                <Fact label={t("firstVisit")}>
                  {guest.firstVisitAt ? <LocalDate value={guest.firstVisitAt} /> : "–"}
                </Fact>
                <Fact label={t("lastVisit")}>{guest.lastVisitAt ? <LocalDate value={guest.lastVisitAt} /> : "–"}</Fact>
                <Fact label={t("language")}>{tLang(guest.language)}</Fact>
                <Fact label={t("lastOffer")}>{guest.lastOffer?.title ?? "–"}</Fact>
                <Fact label={t("consents")}>
                  <span className="flex flex-wrap gap-1">
                    {guest.consents.whatsapp && <Badge variant="secondary">WhatsApp</Badge>}
                    {guest.consents.email && <Badge variant="secondary">Email</Badge>}
                    {!guest.consents.whatsapp && !guest.consents.email && "–"}
                  </span>
                </Fact>
              </dl>
            </article>
          ))}
      </div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  )
}
