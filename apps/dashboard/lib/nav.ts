import { BuildingIcon, LayoutDashboardIcon, NotebookPenIcon, SettingsIcon, UsersIcon } from "lucide-react"
import type { Route } from "next"

export interface NavItem {
  href: Route
  label: string
  icon: typeof LayoutDashboardIcon
  admin?: boolean
}

/** The sidebar and the command palette both read this list, so a module adds its page here once. */
export const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/inbox", label: "Inbox", icon: NotebookPenIcon },
  { href: "/notes", label: "Notes", icon: NotebookPenIcon },
  { href: "/hotel", label: "Hotel", icon: BuildingIcon },
  { href: "/team", label: "Team", icon: UsersIcon },
  { href: "/users", label: "Users", icon: UsersIcon, admin: true },
  { href: "/audit-log", label: "Audit log", icon: SettingsIcon, admin: true },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
]

export const visibleNav = (role: string | null): NavItem[] => NAV.filter((item) => !item.admin || role === "admin")
