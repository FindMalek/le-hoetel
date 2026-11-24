import { SidebarInset, SidebarProvider } from "@le-hoetel/ui/components/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { InboxBell } from "@/components/inbox-bell"
import { call } from "@/lib/api"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [me, { unread }, { hotels, activeId }] = await Promise.all([
    call((api) => api.me.get()),
    call((api) => api.inbox.list()),
    call((api) => api.hotel.mine()),
  ])
  return (
    <SidebarProvider>
      <AppSidebar me={me} hotels={hotels} activeHotelId={activeId} />
      <InboxBell unread={unread} />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}
