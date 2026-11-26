import type { Messages } from "@ritorno/i18n"
import {
  BuildingIcon,
  CalendarHeartIcon,
  ChartColumnIcon,
  CircleUserIcon,
  DatabaseIcon,
  GaugeIcon,
  GiftIcon,
  HistoryIcon,
  HomeIcon,
  HotelIcon,
  InboxIcon,
  MailIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  QrCodeIcon,
  ReceiptIcon,
  ScanLineIcon,
  UploadIcon,
  UserCogIcon,
  UsersIcon,
  UsersRoundIcon,
} from "lucide-react"
import type { Route } from "next"

type NavLabel = keyof Messages["nav"]

export type NavGroupKey = "today" | "guests" | "grow" | "insights" | "settings" | "admin"

export interface NavItem {
  href: Route
  label: NavLabel
  icon: typeof HomeIcon
  group: NavGroupKey
  /** Second key after `g`, Linear style: `g` then `h` goes home. */
  shortcut?: string
}

export interface NavGroup {
  key: NavGroupKey
  label: NavLabel
  items: NavItem[]
}

/** Display order. The platform group leads for the app admin, since that is their daily work. */
const GROUP_LABELS: Record<NavGroupKey, NavLabel> = {
  admin: "admin",
  today: "groupToday",
  guests: "groupGuests",
  grow: "groupGrow",
  insights: "groupInsights",
  settings: "groupSettings",
}

/** The sidebar, the phone "More" sheet, the top bar breadcrumb and the command palette all read this list, so a page adds itself here once. */
// i18n-used: nav
export const NAV: NavItem[] = [
  { href: "/", label: "home", icon: HomeIcon, group: "today", shortcut: "h" },
  { href: "/inbox", label: "inbox", icon: InboxIcon, group: "today", shortcut: "i" },
  { href: "/redeem", label: "redeem", icon: ScanLineIcon, group: "today", shortcut: "r" },
  { href: "/guests", label: "guests", icon: UsersRoundIcon, group: "guests", shortcut: "g" },
  { href: "/guests/import", label: "import", icon: UploadIcon, group: "guests" },
  { href: "/campaigns", label: "campaigns", icon: MegaphoneIcon, group: "grow", shortcut: "c" },
  { href: "/offers", label: "offers", icon: GiftIcon, group: "grow", shortcut: "o" },
  { href: "/holidays", label: "holidays", icon: CalendarHeartIcon, group: "grow" },
  { href: "/emails", label: "emails", icon: MailIcon, group: "grow" },
  { href: "/qr-codes", label: "qrCodes", icon: QrCodeIcon, group: "grow" },
  { href: "/metrics", label: "metrics", icon: ChartColumnIcon, group: "insights", shortcut: "m" },
  { href: "/messages", label: "messages", icon: MessageSquareIcon, group: "insights" },
  { href: "/hotel", label: "hotelNav", icon: HotelIcon, group: "settings" },
  { href: "/team", label: "team", icon: UsersIcon, group: "settings" },
  { href: "/data", label: "data", icon: DatabaseIcon, group: "settings" },
  { href: "/usage", label: "usage", icon: ReceiptIcon, group: "settings" },
  { href: "/settings", label: "account", icon: CircleUserIcon, group: "settings", shortcut: "s" },
  { href: "/admin/overview", label: "adminOverview", icon: GaugeIcon, group: "admin" },
  { href: "/admin/hotels", label: "hotels", icon: BuildingIcon, group: "admin" },
  { href: "/users", label: "users", icon: UserCogIcon, group: "admin" },
  { href: "/audit-log", label: "auditLog", icon: HistoryIcon, group: "admin" },
]

export const visibleNav = (role: string | null): NavItem[] =>
  NAV.filter((item) => item.group !== "admin" || role === "admin")

export const navGroups = (role: string | null): NavGroup[] => {
  const items = visibleNav(role)
  return (Object.keys(GROUP_LABELS) as NavGroupKey[])
    .map((key) => ({ key, label: GROUP_LABELS[key], items: items.filter((item) => item.group === key) }))
    .filter((group) => group.items.length)
}

export const groupLabel = (key: NavGroupKey): NavLabel => GROUP_LABELS[key]

const matches = (href: string, pathname: string): boolean =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)

/** The deepest href a path sits under, so `/guests/import` lights Import and not Guests too. */
export const activeHref = (hrefs: string[], pathname: string): string | undefined =>
  hrefs.filter((href) => matches(href, pathname)).sort((a, b) => b.length - a.length)[0]

/** The nav entry a path belongs to, for the top bar breadcrumb. */
export const navFor = (pathname: string): NavItem | undefined => {
  const href = activeHref(
    NAV.map((item) => item.href),
    pathname,
  )
  return NAV.find((item) => item.href === href)
}
