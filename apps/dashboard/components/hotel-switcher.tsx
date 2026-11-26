"use client"

import { orgClient } from "@ritorno/auth/orgs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ritorno/ui/components/dropdown-menu"
import { SidebarMenuButton } from "@ritorno/ui/components/sidebar"
import { BuildingIcon, CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { HotelAvatar } from "@/components/hotel-avatar"

interface HotelChoice {
  id: string
  name: string
}

interface CurrentHotel {
  name: string
  logoKey: string | null
}

const CARD =
  "h-12 bg-sidebar-accent shadow-xs ring-1 ring-sidebar-border hover:bg-sidebar-accent group-data-[collapsible=icon]:ring-0 group-data-[collapsible=icon]:shadow-none"

export interface HotelSwitcherProps {
  current: CurrentHotel | null
  hotels: HotelChoice[]
  activeId: string | null
  isAdmin: boolean
}

/** The hotel on screen, as a card under the logo. Several hotels, or the app admin, open a list to switch. */
export function HotelSwitcher({ current, hotels, activeId, isAdmin }: HotelSwitcherProps) {
  const t = useTranslations("hotel")
  const tNav = useTranslations("nav")
  const router = useRouter()
  // No `current` with several hotels: the active one is suspended, and the list is the way out.
  if (!current && !isAdmin && hotels.length < 2) return null

  const label = (
    <>
      {current ? (
        <HotelAvatar name={current.name} logoKey={current.logoKey} className="size-8 rounded-md text-sm" />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <BuildingIcon className="size-4" />
        </span>
      )}
      <span className="truncate font-medium">{current?.name ?? tNav("hotels")}</span>
    </>
  )
  if (hotels.length < 2 && !isAdmin)
    return (
      <div className="flex h-12 items-center gap-2 rounded-lg bg-sidebar-accent p-2 text-sm shadow-xs ring-1 ring-sidebar-border group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:ring-0 group-data-[collapsible=icon]:shadow-none">
        {label}
      </div>
    )

  async function pick(organizationId: string) {
    if (organizationId === activeId) return
    const { error } = await orgClient.organization.setActive({ organizationId })
    if (error) return void toast.error(error.message ?? t("switchError"))
    router.push("/")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className={CARD} aria-label={t("switch")} />}>
        {label}
        <ChevronsUpDownIcon className="ms-auto text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-60">
        {hotels.length ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("yours")}</DropdownMenuLabel>
            {hotels.map((hotel) => (
              <DropdownMenuItem key={hotel.id} className="min-h-11" onClick={() => pick(hotel.id)}>
                <span className="truncate">{hotel.name}</span>
                {hotel.id === activeId ? <CheckIcon className="ms-auto" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ) : null}
        {isAdmin ? (
          <>
            {hotels.length ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem className="min-h-11" onClick={() => router.push("/admin/hotels")}>
              <BuildingIcon />
              {tNav("hotels")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
