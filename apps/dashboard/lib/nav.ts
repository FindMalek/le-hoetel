import type { Messages } from "@le-hoetel/i18n"
import {
  BuildingIcon,
  DatabaseIcon,
  GaugeIcon,
  GiftIcon,
  HistoryIcon,
  HotelIcon,
  InboxIcon,
  LayoutDashboardIcon,
  MailIcon,
  MessageSquareIcon,
  QrCodeIcon,
  ScanLineIcon,
  SettingsIcon,
  UserCogIcon,
  UsersIcon,
  UsersRoundIcon,
} from "lucide-react"
import type { Route } from "next"

export interface NavItem {
  href: Route
  label: keyof Messages["nav"]
  icon: typeof LayoutDashboardIcon
  admin?: boolean
  /** Shown in the phone tab bar; everything else lives under "More". */
  tab?: boolean
}

/** The sidebar, the phone tab bar and the command palette all read this list, so a page adds itself here once. */
// i18n-used: nav
export const NAV: NavItem[] = [
  { href: "/", label: "overview", icon: LayoutDashboardIcon, tab: true },
  { href: "/guests", label: "guests", icon: UsersRoundIcon, tab: true },
  { href: "/messages", label: "messages", icon: MessageSquareIcon, tab: true },
  { href: "/inbox", label: "inbox", icon: InboxIcon },
  { href: "/hotel", label: "hotelNav", icon: HotelIcon },
  { href: "/redeem", label: "redeem", icon: ScanLineIcon },
  { href: "/offers", label: "offers", icon: GiftIcon },
  { href: "/emails", label: "emails", icon: MailIcon },
  { href: "/qr-codes", label: "qrCodes", icon: QrCodeIcon },
  { href: "/team", label: "team", icon: UsersIcon },
  { href: "/data", label: "data", icon: DatabaseIcon },
  { href: "/admin/overview", label: "adminOverview", icon: GaugeIcon, admin: true },
  { href: "/admin/hotels", label: "hotels", icon: BuildingIcon, admin: true },
  { href: "/users", label: "users", icon: UserCogIcon, admin: true },
  { href: "/audit-log", label: "auditLog", icon: HistoryIcon, admin: true },
  { href: "/settings", label: "settings", icon: SettingsIcon },
]

export const visibleNav = (role: string | null): NavItem[] => NAV.filter((item) => !item.admin || role === "admin")

export const isActive = (href: string, pathname: string): boolean =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)

/** The nav entry a path belongs to, for the top bar title. */
export const navFor = (pathname: string): NavItem | undefined => NAV.find((item) => isActive(item.href, pathname))
