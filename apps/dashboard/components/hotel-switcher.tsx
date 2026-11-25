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
import { BrandMark } from "@/components/brand-mark"

const Initial = ({ name }: { name: string }) => (
  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-semibold text-primary-foreground">
    {name.trim().slice(0, 1).toUpperCase()}
  </span>
)

/** The active hotel as the sidebar header. With more than one hotel it opens the list to switch. */
export interface HotelChoice {
  id: string
  name: string
}

export function HotelSwitcher({ hotels, activeId }: { hotels: HotelChoice[]; activeId: string | null }) {
  const t = useTranslations("hotel")
  const router = useRouter()
  const active = hotels.find((hotel) => hotel.id === activeId)

  if (!active)
    return (
      <SidebarMenuButton size="lg" render={<Link href="/" />}>
        <BrandMark />
      </SidebarMenuButton>
    )

  const label = (
    <>
      <Initial name={active.name} />
      <span className="truncate font-heading font-semibold">{active.name}</span>
    </>
  )
  if (hotels.length < 2)
    return (
      <SidebarMenuButton size="lg" render={<Link href="/" />}>
        {label}
      </SidebarMenuButton>
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
              {hotel.id === activeId ? <CheckIcon className="ms-auto" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
