"use client"

import { Kbd } from "@le-hoetel/ui/components/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@le-hoetel/ui/components/sidebar"
import { SearchIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { openCommandPalette } from "@/components/command-palette"
import { type HotelChoice, HotelSwitcher } from "@/components/hotel-switcher"
import { type Me, UserMenu } from "@/components/user-menu"
import { isActive, visibleNav } from "@/lib/nav"

// i18n-used: shell.search
// i18n-used: shell.mainNav

export function AppSidebar({
  me,
  hotels,
  activeHotelId,
}: {
  me: Me
  hotels: HotelChoice[]
  activeHotelId: string | null
}) {
  const pathname = usePathname()
  const t = useTranslations("nav")
  const tShell = useTranslations("shell")
  const items = visibleNav(me.role)
  const groups = [
    { key: "main", items: items.filter((item) => !item.admin) },
    { key: "admin", items: items.filter((item) => item.admin) },
  ].filter((group) => group.items.length)
  return (
    <Sidebar collapsible="icon" aria-label={tShell("mainNav")}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <HotelSwitcher hotels={hotels} activeId={activeHotelId} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={tShell("search")} onClick={openCommandPalette}>
                  <SearchIcon />
                  <span>{tShell("search")}</span>
                  <Kbd className="ms-auto" dir="ltr">
                    ⌘K
                  </Kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {groups.map((group) => (
          <SidebarGroup key={group.key}>
            {group.key === "admin" ? <SidebarGroupLabel>{t("admin")}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={t(item.label)}
                      isActive={isActive(item.href, pathname)}
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{t(item.label)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu me={me} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
