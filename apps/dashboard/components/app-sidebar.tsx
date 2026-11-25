"use client"

import { authClient } from "@le-hoetel/auth/client"
import { Avatar, AvatarFallback, AvatarImage } from "@le-hoetel/ui/components/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@le-hoetel/ui/components/sidebar"
import { LogOutIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { CommandPalette } from "@/components/command-palette"
import { type HotelChoice, HotelSwitcher } from "@/components/hotel-switcher"
import { visibleNav } from "@/lib/nav"

interface Me {
  name: string
  email: string
  image: string | null
  role: string | null
}

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
  const signOut = async () => {
    await authClient.signOut()
    window.location.assign("/sign-in")
  }
  return (
    <Sidebar collapsible="icon" variant="inset">
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
              <CommandPalette role={me.role} />
              {visibleNav(me.role).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    tooltip={t(item.label)}
                    isActive={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
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
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Sign out" onClick={signOut}>
              <Avatar className="size-8">
                {me.image && <AvatarImage src={me.image} alt="" />}
                <AvatarFallback>{me.name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">{me.name}</span>
                <span className="truncate text-muted-foreground text-xs">{me.email}</span>
              </span>
              <LogOutIcon className="ms-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
