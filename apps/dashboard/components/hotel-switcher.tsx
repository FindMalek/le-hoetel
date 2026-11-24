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
export function HotelSwitcher({ activeName }: { activeName: string | null }) {
  const t = useTranslations("hotel")
  const router = useRouter()
  const { data: hotels } = orgClient.useListOrganizations()
  const { data: active } = orgClient.useActiveOrganization()

  if (!activeName)
    return (
      <SidebarMenuButton size="lg" render={<Link href="/" />}>
        <BrandMark />
      </SidebarMenuButton>
    )

  const label = (
    <>
      <Initial name={activeName} />
      <span className="truncate font-heading font-semibold">{activeName}</span>
    </>
  )
  if (!hotels || hotels.length < 2)
    return (
      <SidebarMenuButton size="lg" render={<Link href="/" />}>
        {label}
      </SidebarMenuButton>
    )

  async function pick(organizationId: string) {
    if (organizationId === active?.id) return
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
              {hotel.id === active?.id ? <CheckIcon className="ms-auto" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
