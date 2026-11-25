import type { Messages } from "@le-hoetel/i18n"
import {
  BuildingIcon,
  DatabaseIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  NotebookPenIcon,
  QrCodeIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"
import type { Route } from "next"

export interface NavItem {
  href: Route
  label: keyof Messages["nav"]
  icon: typeof LayoutDashboardIcon
  admin?: boolean
}

/** The sidebar and the command palette both read this list, so a module adds its page here once. */
// i18n-used: nav
export const NAV: NavItem[] = [
  { href: "/", label: "overview", icon: LayoutDashboardIcon },
  { href: "/guests", label: "guests", icon: UsersIcon },
  { href: "/inbox", label: "inbox", icon: NotebookPenIcon },
  { href: "/notes", label: "notes", icon: NotebookPenIcon },
  { href: "/hotel", label: "hotelNav", icon: BuildingIcon },
  { href: "/qr-codes", label: "qrCodes", icon: QrCodeIcon },
  { href: "/messages", label: "messages", icon: MessageSquareIcon },
  { href: "/team", label: "team", icon: UsersIcon },
  { href: "/data", label: "data", icon: DatabaseIcon },
  { href: "/admin/hotels", label: "hotels", icon: BuildingIcon, admin: true },
  { href: "/users", label: "users", icon: UsersIcon, admin: true },
  { href: "/audit-log", label: "auditLog", icon: SettingsIcon, admin: true },
  { href: "/settings", label: "settings", icon: SettingsIcon },
]

export const visibleNav = (role: string | null): NavItem[] => NAV.filter((item) => !item.admin || role === "admin")
