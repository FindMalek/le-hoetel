import { DEFAULT_LOCALE, getDirection, isLocale } from "@le-hoetel/i18n"
import { SidebarInset, SidebarProvider } from "@le-hoetel/ui/components/sidebar"
import { getLocale } from "next-intl/server"
import { AppSidebar } from "@/components/app-sidebar"
import { InboxBell } from "@/components/inbox-bell"
import { call } from "@/lib/api"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await call((api) => api.me.get())
  const { unread } = await call((api) => api.inbox.list())
  const locale = await getLocale()
  const rtl = getDirection(isLocale(locale) ? locale : DEFAULT_LOCALE) === "rtl"
  return (
    <SidebarProvider>
      <AppSidebar me={me} side={rtl ? "right" : "left"} />
      <InboxBell unread={unread} />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}
