import { brandStyle } from "@le-hoetel/common/color"
import { isForbidden } from "@le-hoetel/orpc/errors"
import { SidebarInset, SidebarProvider } from "@le-hoetel/ui/components/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { InboxBell } from "@/components/inbox-bell"
import { call } from "@/lib/api"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [me, { unread }, { hotels, activeId }, hotel] = await Promise.all([
    call((api) => api.me.get()),
    call((api) => api.inbox.list()),
    call((api) => api.hotel.mine()),
    call((api) => api.hotel.get()).catch((error) => {
      if (isForbidden(error)) return null
      throw error
    }),
  ])
  return (
    <SidebarProvider
      // the hotel's colors are css variables built by brandStyle
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={hotel ? brandStyle(hotel) : undefined}
    >
      <AppSidebar me={me} hotels={hotels} activeHotelId={activeId} />
      <InboxBell unread={unread} />
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  )
}
