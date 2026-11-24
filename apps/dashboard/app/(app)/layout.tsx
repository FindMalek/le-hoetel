import { brandStyle } from "@le-hoetel/common/color"
import { isForbidden } from "@le-hoetel/orpc/errors"
import { SidebarInset, SidebarProvider } from "@le-hoetel/ui/components/sidebar"
import { getTranslations } from "next-intl/server"
import { AppSidebar } from "@/components/app-sidebar"
import { BottomTabs } from "@/components/bottom-tabs"
import { CommandPalette } from "@/components/command-palette"
import { FeedbackButton } from "@/components/feedback-button"
import { InboxBell } from "@/components/inbox-bell"
import { TopBar } from "@/components/top-bar"
import { call } from "@/lib/api"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("shell")
  const me = await call((api) => api.me.get())
  const { unread } = await call((api) => api.inbox.list())
  const hotel = await call((api) => api.hotel.get()).catch((error) => {
    if (isForbidden(error)) return null
    throw error
  })
  return (
    <SidebarProvider
      className="[--bottom-nav-height:calc(3.5rem+env(safe-area-inset-bottom))] md:[--bottom-nav-height:0px]"
      // the hotel's colors are css variables built by brandStyle
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={hotel ? brandStyle(hotel) : undefined}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-3 focus:shadow-lg"
      >
        {t("skip")}
      </a>
      <AppSidebar me={me} hotelName={hotel?.displayName ?? null} />
      <SidebarInset id="main" className="min-w-0">
        <TopBar bell={<InboxBell unread={unread} />} />
        <div className="mx-auto w-full max-w-6xl flex-1 pb-nav">{children}</div>
      </SidebarInset>
      <BottomTabs me={me} />
      <CommandPalette role={me.role} />
      <FeedbackButton />
    </SidebarProvider>
  )
}
