import { SidebarInset, SidebarProvider } from "@le-hoetel/ui/components/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { InboxBell } from "@/components/inbox-bell"
import { call } from "@/lib/api"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await call((api) => api.me.get())
  const { unread } = await call((api) => api.inbox.list())
  return (
    <SidebarProvider>
      <AppSidebar me={me} />
      <InboxBell unread={unread} />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}
