import type { Messages } from "@ritorno/i18n"
import {
  BuildingIcon,
  CalendarHeartIcon,
  ChartColumnIcon,
  CircleUserIcon,
  DatabaseIcon,
  FrownIcon,
  GaugeIcon,
  GiftIcon,
  HistoryIcon,
  HomeIcon,
  HotelIcon,
  InboxIcon,
  MailIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  MessageSquareIcon,
  QrCodeIcon,
  ReceiptIcon,
  ScanLineIcon,
  UploadIcon,
  UserCogIcon,
  UserPlusIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react"
import type { Route } from "next"
import { allows, type HotelPermission, type Viewer } from "@/lib/viewer"

type NavLabel = keyof Messages["nav"]

export type NavGroupKey = "today" | "guests" | "grow" | "insights" | "settings" | "admin"

export interface NavItem {
  href: Route
  label: NavLabel
  icon: typeof HomeIcon
  group: NavGroupKey
  /** Needs a hotel on screen: any role, or one holding this permission. */
  hotel?: "any" | HotelPermission
  /** Second key after `g`, Linear style: `g` then `h` goes home. */
  shortcut?: string
}

export interface NavGroup {
  key: NavGroupKey
  label: NavLabel
  items: NavItem[]
}

export interface QuickAction {
  href: Route
  label: "addGuest" | "redeemCode" | "newCampaign" | "newOffer"
  icon: typeof HomeIcon
  hotel: HotelPermission
}

// i18n-used: shell.actions
const QUICK_ACTIONS: QuickAction[] = [
  { href: "/guests/new", label: "addGuest", icon: UserPlusIcon, hotel: { guest: ["create"] } },
  { href: "/redeem", label: "redeemCode", icon: ScanLineIcon, hotel: { offer: ["redeem"] } },
  { href: "/campaigns/new", label: "newCampaign", icon: MegaphoneIcon, hotel: { campaign: ["create"] } },
  { href: "/offers/new", label: "newOffer", icon: GiftIcon, hotel: { offer: ["create"] } },
]

export const quickActions = ({ role }: Viewer): QuickAction[] =>
  QUICK_ACTIONS.filter((action) => allows(role, action.hotel))

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
  { href: "/feedback", label: "unhappyGuests", icon: FrownIcon, group: "today", hotel: { guest: ["read"] } },
  { href: "/whatsapp", label: "whatsappScans", icon: MessageCircleIcon, group: "today", hotel: { guest: ["read"] } },
  { href: "/redeem", label: "redeem", icon: ScanLineIcon, group: "today", hotel: { offer: ["redeem"] }, shortcut: "r" },
  {
    href: "/guests",
    label: "guests",
    icon: UsersRoundIcon,
    group: "guests",
    hotel: { guest: ["read"] },
    shortcut: "g",
  },
  { href: "/guests/import", label: "import", icon: UploadIcon, group: "guests", hotel: { guest: ["import"] } },
  {
    href: "/campaigns",
    label: "campaigns",
    icon: MegaphoneIcon,
    group: "grow",
    hotel: { campaign: ["read"] },
    shortcut: "c",
  },
  { href: "/offers", label: "offers", icon: GiftIcon, group: "grow", hotel: { offer: ["read"] }, shortcut: "o" },
  { href: "/holidays", label: "holidays", icon: CalendarHeartIcon, group: "grow", hotel: { organization: ["update"] } },
  { href: "/emails", label: "emails", icon: MailIcon, group: "grow", hotel: "any" },
  { href: "/qr-codes", label: "qrCodes", icon: QrCodeIcon, group: "grow", hotel: "any" },
  {
    href: "/metrics",
    label: "metrics",
    icon: ChartColumnIcon,
    group: "insights",
    hotel: { guest: ["read"] },
    shortcut: "m",
  },
  { href: "/messages", label: "messages", icon: MessageSquareIcon, group: "insights", hotel: { guest: ["read"] } },
  { href: "/hotel", label: "hotelNav", icon: HotelIcon, group: "settings", hotel: { organization: ["update"] } },
  { href: "/team", label: "team", icon: UsersIcon, group: "settings", hotel: "any" },
  { href: "/data", label: "data", icon: DatabaseIcon, group: "settings", hotel: { guest: ["export", "delete"] } },
  {
    href: "/activity",
    label: "activityLog",
    icon: HistoryIcon,
    group: "settings",
    hotel: { organization: ["update"] },
  },
  { href: "/usage", label: "usage", icon: ReceiptIcon, group: "settings", hotel: { organization: ["update"] } },
  { href: "/settings", label: "account", icon: CircleUserIcon, group: "settings", shortcut: "s" },
  { href: "/admin/overview", label: "adminOverview", icon: GaugeIcon, group: "admin" },
  { href: "/admin/hotels", label: "hotels", icon: BuildingIcon, group: "admin" },
  { href: "/admin/billing", label: "billing", icon: WalletIcon, group: "admin" },
  { href: "/users", label: "users", icon: UserCogIcon, group: "admin" },
  { href: "/audit-log", label: "auditLog", icon: HistoryIcon, group: "admin" },
]

const isVisible = (item: NavItem, { admin, role }: Viewer): boolean => {
  if (item.group === "admin") return admin
  if (!item.hotel) return true
  return item.hotel === "any" ? role !== null : allows(role, item.hotel)
}

export const visibleNav = (viewer: Viewer): NavItem[] => NAV.filter((item) => isVisible(item, viewer))

export const navGroups = (viewer: Viewer): NavGroup[] => {
  const items = visibleNav(viewer)
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
