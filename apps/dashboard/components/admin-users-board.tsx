"use client"

import type { AppRouterClient } from "@le-hoetel/orpc/client"
import { Badge } from "@le-hoetel/ui/components/badge"
import { Button } from "@le-hoetel/ui/components/button"
import { type DataColumn, DataTable } from "@le-hoetel/ui/components/data-table"
import { EmptyState } from "@le-hoetel/ui/components/empty-state"
import { Input } from "@le-hoetel/ui/components/input"
import { Label } from "@le-hoetel/ui/components/label"
import { SearchXIcon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { LocalDate } from "@/components/local-date"

type User = Awaited<ReturnType<AppRouterClient["admin"]["users"]>>["users"][number]

export function AdminUsersBoard({ users }: { users: User[] }) {
  const t = useTranslations("adminUsers")
  const [query, setQuery] = useState("")
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(needle)) : users
  }, [users, query])

  const person = (user: User) => (
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-medium">{user.name}</span>
      <span className="truncate text-muted-foreground text-xs" dir="ltr">
        {user.email}
      </span>
    </span>
  )
  const role = (user: User) => (
    <Badge variant={user.role === "admin" ? "default" : "outline"}>
      {user.role === "admin" ? t("roleAdmin") : t("roleUser")}
    </Badge>
  )
  const hotels = (user: User) =>
    user.hotels.length ? (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {user.hotels.map((hotel) => (
          <Link
            key={hotel.id}
            href={`/admin/hotels/${hotel.id}`}
            className="text-sm underline-offset-4 hover:underline"
          >
            {hotel.name} <span className="text-muted-foreground">· {hotel.role.split(",")[0]}</span>
          </Link>
        ))}
      </span>
    ) : (
      <span className="text-muted-foreground">{t("noHotel")}</span>
    )

  const columns: DataColumn<User>[] = [
    { id: "user", header: t("columns.user"), cell: person },
    { id: "role", header: t("columns.role"), cell: role },
    { id: "hotels", header: t("columns.hotels"), cell: hotels, showFrom: "lg" },
    { id: "joined", header: t("columns.joined"), cell: (user) => <LocalDate value={user.createdAt} />, align: "end" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid max-w-sm gap-1.5">
        <Label htmlFor="user-search">{t("search")}</Label>
        <Input
          id="user-search"
          type="search"
          value={query}
          enterKeyHint="search"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <DataTable
        caption={t("title")}
        rows={rows}
        columns={columns}
        getRowKey={(user) => user.id}
        empty={
          <EmptyState
            icon={<SearchXIcon />}
            title={t("noMatch.title")}
            description={t("noMatch.description")}
            action={
              <Button variant="outline" onClick={() => setQuery("")}>
                {t("reset")}
              </Button>
            }
          />
        }
        card={(user) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              {person(user)}
              {role(user)}
            </div>
            <div className="text-sm">{hotels(user)}</div>
            <p className="text-muted-foreground text-xs">
              {t("columns.joined")} · <LocalDate value={user.createdAt} />
            </p>
          </div>
        )}
      />
    </div>
  )
}
