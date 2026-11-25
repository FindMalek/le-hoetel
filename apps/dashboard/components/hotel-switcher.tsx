"use client"

import { orgClient } from "@le-hoetel/auth/orgs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@le-hoetel/ui/components/dropdown-menu"
import { SidebarMenuButton } from "@le-hoetel/ui/components/sidebar"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

export interface HotelChoice {
  id: string
  name: string
}

const Logo = ({ name }: { name: string }) => (
  <span className="grid size-8 shrink-0 place-items-center bg-primary font-bold text-primary-foreground">
    {name.slice(0, 1).toUpperCase()}
  </span>
)

export function HotelSwitcher({ hotels, activeId }: { hotels: HotelChoice[]; activeId: string | null }) {
  const t = useTranslations("hotel")
  const router = useRouter()
  const active = hotels.find((hotel) => hotel.id === activeId)
  if (!active) {
    return (
      <SidebarMenuButton size="lg" render={<Link href="/" />}>
        <Logo name="le-hoetel" />
        <span className="font-heading font-semibold">le-hoetel</span>
      </SidebarMenuButton>
    )
  }
  const label = (
    <>
      <Logo name={active.name} />
      <span className="truncate font-heading font-semibold">{active.name}</span>
    </>
  )
  if (hotels.length < 2)
    return (
      <SidebarMenuButton size="lg" render={<Link href="/guests" />}>
        {label}
      </SidebarMenuButton>
    )

  async function pick(organizationId: string) {
    if (organizationId === activeId) return
    const { error } = await orgClient.organization.setActive({ organizationId })
    if (error) return void toast.error(error.message ?? "Something went wrong.")
    router.push("/guests")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton size="lg" aria-label={t("switch")} />}>
        {label}
        <ChevronsUpDownIcon className="ms-auto" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("yours")}</DropdownMenuLabel>
          {hotels.map((hotel) => (
            <DropdownMenuItem key={hotel.id} className="min-h-11" onClick={() => pick(hotel.id)}>
              <span className="truncate">{hotel.name}</span>
              {hotel.id === activeId && <CheckIcon className="ms-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
