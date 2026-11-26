"use client"

import { Button } from "@ritorno/ui/components/button"
import { Kbd } from "@ritorno/ui/components/kbd"
import { Separator } from "@ritorno/ui/components/separator"
import { useSidebar } from "@ritorno/ui/components/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@ritorno/ui/components/tooltip"
import { ChevronRightIcon, PanelLeftIcon, SearchIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { openCommandPalette } from "@/components/command-palette"
import { MoreSheet } from "@/components/more-sheet"
import type { Me } from "@/components/user-menu"
import { groupLabel, navFor } from "@/lib/nav"

// i18n-used: shell.toggleSidebar

function SidebarToggle() {
  const { toggleSidebar } = useSidebar()
  const t = useTranslations("shell")
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={t("toggleSidebar")} onClick={toggleSidebar} />}
      >
        <PanelLeftIcon className="rtl:-scale-x-100 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {t("toggleSidebar")}
        <Kbd dir="ltr">⌘B</Kbd>
      </TooltipContent>
    </Tooltip>
  )
}

/** Where you are, not what the page is called: the section, then the page as a link once you go deeper. */
function Crumbs() {
  const t = useTranslations("nav")
  const pathname = usePathname()
  const item = navFor(pathname)
  if (!item) return null
  const group = t(groupLabel(item.group))
  const page = t(item.label)
  return (
    <ol className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-sm">
      {group !== page ? (
        <>
          <li className="truncate">{group}</li>
          <li aria-hidden>
            <ChevronRightIcon className="rtl:-scale-x-100 size-3.5" />
          </li>
        </>
      ) : null}
      <li className="truncate">
        {pathname === item.href ? (
          <span aria-current="page" className="text-foreground">
            {page}
          </span>
        ) : (
          <Link href={item.href} className="rounded-sm transition-colors hover:text-foreground">
            {page}
          </Link>
        )}
      </li>
    </ol>
  )
}

/** Breadcrumb, search and notifications. Page titles and actions live in each page's `PageHeader`. */
export function TopBar({ me, hotelName, bell }: { me: Me; hotelName: string | null; bell: React.ReactNode }) {
  const t = useTranslations("shell")
  return (
    <div className="flex h-14 items-center gap-2 px-2 md:px-4">
      <MoreSheet me={me} className="md:hidden" />
      <p className="min-w-0 flex-1 truncate font-medium text-sm md:hidden">{hotelName}</p>
      <div className="flex min-w-0 flex-1 items-center gap-3 max-md:hidden">
        <SidebarToggle />
        <Separator orientation="vertical" className="data-vertical:h-4 data-vertical:self-center" />
        <nav aria-label={t("breadcrumb")} className="min-w-0">
          <Crumbs />
        </nav>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 md:hidden"
        aria-label={t("search")}
        onClick={openCommandPalette}
      >
        <SearchIcon className="size-5" />
      </Button>
      <Button
        variant="outline"
        className="w-56 justify-start text-muted-foreground shadow-xs max-lg:w-auto max-md:hidden"
        onClick={openCommandPalette}
      >
        <SearchIcon data-icon="inline-start" />
        <span className="flex-1 text-start">{t("search")}</span>
        <Kbd dir="ltr">⌘K</Kbd>
      </Button>
      <div className="max-md:hidden">{bell}</div>
    </div>
  )
}
