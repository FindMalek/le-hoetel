"use client"

import { Logo } from "@ritorno/ui/brand/logo"
import { Kbd, KbdGroup } from "@ritorno/ui/components/kbd"
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
  useSidebar,
} from "@ritorno/ui/components/sidebar"
import { cn } from "@ritorno/ui/lib/utils"
import { ChevronRightIcon, MessageSquareIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { openFeedback } from "@/components/feedback-button"
import { type CurrentHotel, type HotelChoice, HotelSwitcher } from "@/components/hotel-switcher"
import { type Me, UserMenu } from "@/components/user-menu"
import { activeHref, type NavGroup, navGroups } from "@/lib/nav"

// i18n-used: shell.mainNav
// i18n-used: shell.feedback

/** Quiet rows on the surface, the active one a white pill. Rows grow to 44 px on touch screens. */
export const NAV_ROW =
  "coarse:h-11 text-sidebar-foreground/75 hover:bg-sidebar-accent/70 data-active:bg-sidebar-accent data-active:text-sidebar-foreground data-active:shadow-xs data-active:ring-1 data-active:ring-sidebar-border [&_svg]:text-muted-foreground data-active:[&_svg]:text-sidebar-foreground"

const LABEL = "h-6 font-medium text-muted-foreground text-xs"

/** Settings folds away at the bottom so the daily groups fit a laptop screen; it opens on its own when you are inside. */
function NavSection({
  group,
  active,
  foldable = false,
}: {
  group: NavGroup
  active: string | undefined
  foldable?: boolean
}) {
  const t = useTranslations("nav")
  const { state } = useSidebar()
  const inside = group.items.some((item) => item.href === active)
  const [open, setOpen] = useState(inside)
  useEffect(() => {
    if (inside) setOpen(true)
  }, [inside])
  const shown = !foldable || open || state === "collapsed"
  return (
    <SidebarGroup className="py-1">
      {foldable ? (
        <SidebarGroupLabel
          render={<button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} />}
          className={cn(LABEL, "w-full gap-1 hover:text-sidebar-foreground")}
        >
          {t(group.label)}
          <ChevronRightIcon
            aria-hidden
            className={cn("size-3.5! transition-transform rtl:-scale-x-100", open && "rotate-90 rtl:rotate-90")}
          />
        </SidebarGroupLabel>
      ) : (
        <SidebarGroupLabel className={LABEL}>{t(group.label)}</SidebarGroupLabel>
      )}
      <SidebarGroupContent hidden={!shown}>
        <SidebarMenu className="gap-px">
          {group.items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                tooltip={t(item.label)}
                isActive={item.href === active}
                className={NAV_ROW}
                render={<Link href={item.href} aria-current={item.href === active ? "page" : undefined} />}
              >
                <item.icon />
                <span>{t(item.label)}</span>
                {item.shortcut ? (
                  <KbdGroup
                    aria-hidden
                    className="ms-auto opacity-0 transition-opacity group-hover/menu-button:opacity-100 group-data-[collapsible=icon]:hidden coarse:hidden"
                  >
                    <Kbd>G</Kbd>
                    <Kbd>{item.shortcut.toUpperCase()}</Kbd>
                  </KbdGroup>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function AppSidebar({
  me,
  current,
  hotels,
  activeHotelId,
}: {
  me: Me
  current: CurrentHotel | null
  hotels: HotelChoice[]
  activeHotelId: string | null
}) {
  const pathname = usePathname()
  const t = useTranslations("shell")
  const groups = navGroups(me.role)
  const active = activeHref(
    groups.flatMap((group) => group.items.map((item) => item.href)),
    pathname,
  )
  return (
    <Sidebar collapsible="icon" aria-label={t("mainNav")}>
      <SidebarHeader className="gap-3 px-3 pt-4">
        <Link
          href="/"
          className="flex h-8 items-center rounded-md px-1 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Logo size={22} className="group-data-[collapsible=icon]:hidden" />
          <Logo variant="mark" size={24} label="Ritorno" className="hidden group-data-[collapsible=icon]:block" />
        </Link>
        <SidebarMenu>
          <SidebarMenuItem>
            <HotelSwitcher current={current} hotels={hotels} activeId={activeHotelId} isAdmin={me.role === "admin"} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {groups
          .filter((group) => group.key !== "settings")
          .map((group) => (
            <NavSection key={group.key} group={group} active={active} />
          ))}
        <div className="mt-auto flex flex-col pt-3">
          {groups
            .filter((group) => group.key === "settings")
            .map((group) => (
              <NavSection key={group.key} group={group} active={active} foldable />
            ))}
        </div>
      </SidebarContent>
      <SidebarFooter className="gap-1 border-sidebar-border border-t px-3 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t("feedback")} onClick={openFeedback} className={NAV_ROW}>
              <MessageSquareIcon />
              <span>{t("feedback")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <UserMenu me={me} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
