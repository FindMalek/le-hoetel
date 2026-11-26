"use client"

import type { AppRouterClient } from "@ritorno/orpc/client"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import { DataList } from "@ritorno/ui/components/data-list"
import type { DataColumn } from "@ritorno/ui/components/data-table"
import { FormField } from "@ritorno/ui/components/form-field"
import { Input } from "@ritorno/ui/components/input"
import { PageState } from "@ritorno/ui/components/page-state"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { useMutation } from "@tanstack/react-query"
import { SearchXIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { toast } from "sonner"

type User = Awaited<ReturnType<AppRouterClient["admin"]["users"]>>["users"][number]

const SHOWS = ["all", "admins", "banned"] as const
type Show = (typeof SHOWS)[number]

export function AdminUsersBoard({ users, meId }: { users: User[]; meId: string }) {
  const t = useTranslations("adminUsers")
  const locale = useLocale()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [show, setShow] = useState<Show>("all")
  const [target, setTarget] = useState<User | null>(null)
  const [confirming, setConfirming] = useState(false)
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return users.filter(
      (user) =>
        (!needle || `${user.name} ${user.email}`.toLowerCase().includes(needle)) &&
        (show === "all" || (show === "admins" ? user.role === "admin" : user.banned)),
    )
  }, [users, query, show])
  const reset = () => {
    setQuery("")
    setShow("all")
  }

  const setBanned = useMutation(
    orpc.admin.setBanned.mutationOptions({
      onSuccess: (_, input) => {
        setConfirming(false)
        toast.success(input.banned ? t("banned") : t("unbanned"))
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  const person = (user: User) => (
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-medium">{user.name}</span>
      <span className="truncate text-caption text-muted-foreground" dir="ltr">
        {user.email}
      </span>
    </span>
  )
  const role = (user: User) => (
    <span className="flex flex-wrap gap-2">
      <StatusBadge tone={user.role === "admin" ? "info" : "neutral"} icon={null}>
        {user.role === "admin" ? t("roleAdmin") : t("roleUser")}
      </StatusBadge>
      {user.banned ? <StatusBadge tone="danger">{t("bannedBadge")}</StatusBadge> : null}
    </span>
  )
  const hotels = (user: User) =>
    user.hotels.length ? (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {user.hotels.map((hotel) => (
          <Link key={hotel.id} href={`/admin/hotels/${hotel.id}`} className="text-primary underline underline-offset-4">
            {hotel.name}
          </Link>
        ))}
      </span>
    ) : (
      <span className="text-muted-foreground">{t("noHotel")}</span>
    )
  const action = (user: User) =>
    user.id === meId ? (
      <span className="text-caption text-muted-foreground">{t("you")}</span>
    ) : user.role === "admin" ? null : (
      <Button
        variant={user.banned ? "outline" : "ghost"}
        className={user.banned ? undefined : "text-destructive"}
        onClick={() => {
          setTarget(user)
          setConfirming(true)
        }}
      >
        {user.banned ? t("unban") : t("ban")}
      </Button>
    )

  const columns: DataColumn<User>[] = [
    { id: "user", header: t("columns.user"), cell: person },
    { id: "role", header: t("columns.role"), cell: role },
    { id: "hotels", header: t("columns.hotels"), cell: hotels, showFrom: "lg" },
    {
      id: "joined",
      header: t("columns.joined"),
      cell: (user) => formatDate(user.createdAt, locale),
      align: "end",
      showFrom: "lg",
    },
    { id: "action", header: <span className="sr-only">{t("columns.action")}</span>, cell: action, align: "end" },
  ]

  return (
    <>
      <DataList
        caption={t("title")}
        rows={rows}
        columns={columns}
        getRowKey={(user) => user.id}
        filters={
          <>
            <FormField label={t("search")} className="w-full sm:max-w-sm">
              {(aria) => (
                <Input
                  {...aria}
                  type="search"
                  value={query}
                  enterKeyHint="search"
                  autoComplete="off"
                  onChange={(event) => setQuery(event.target.value)}
                />
              )}
            </FormField>
            <SegmentedControl
              label={t("show")}
              value={show}
              onValueChange={setShow}
              className="max-sm:w-full"
              block
              options={SHOWS.map((value) => ({ value, label: t(`shows.${value}`) }))}
            />
          </>
        }
        empty={
          <PageState
            kind="empty"
            icon={<SearchXIcon />}
            title={t("noMatch.title")}
            description={t("noMatch.description")}
            action={
              <Button variant="outline" onClick={reset}>
                {t("reset")}
              </Button>
            }
          />
        }
        card={(user) => (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              {person(user)}
              {role(user)}
            </div>
            <div className="text-small">{hotels(user)}</div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-caption text-muted-foreground">
                {t("joinedOn", { date: formatDate(user.createdAt, locale) })}
              </span>
              {action(user)}
            </div>
          </div>
        )}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        destructive={!target?.banned}
        pending={setBanned.isPending}
        title={target?.banned ? t("unbanTitle", { name: target.name }) : t("banTitle", { name: target?.name ?? "" })}
        description={target?.banned ? t("unbanConsequence") : t("banConsequence")}
        confirmLabel={target?.banned ? t("unban") : t("ban")}
        cancelLabel={t("cancel")}
        onConfirm={() => target && setBanned.mutate({ userId: target.id, banned: !target.banned })}
      />
    </>
  )
}
