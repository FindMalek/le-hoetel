import { SidebarInset, SidebarProvider } from "@ritorno/ui/components/sidebar"
import { getTranslations } from "next-intl/server"
import { AppSidebar } from "@/components/app-sidebar"
import { BottomTabs } from "@/components/bottom-tabs"
import { CommandPalette } from "@/components/command-palette"
import { FeedbackDialog } from "@/components/feedback-button"
import { InboxBell } from "@/components/inbox-bell"
import { TopBar } from "@/components/top-bar"
import { ViewingBanner } from "@/components/viewing-banner"
import { call } from "@/lib/api"
import { viewedHotelId } from "@/lib/view-hotel"

/** `--app-header` is the sticky header height (top bar, plus the viewing banner when it shows) that sticky table headers sit under. */
const SHELL_VARS =
  "[--bottom-nav-height:calc(3.5rem+env(safe-area-inset-bottom))] md:[--bottom-nav-height:0px] [--app-header:3.5rem] has-data-viewing-banner:[--app-header:6.5rem]"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("shell")
  const [me, { unread }, { hotels, activeId }, hotel, viewedId] = await Promise.all([
    call((api) => api.me.get()),
    call((api) => api.inbox.list()),
    call((api) => api.hotel.mine()),
    call((api) => api.hotel.get().catch(() => null)),
    viewedHotelId(),
  ])
  const current = hotel ? { name: hotel.displayName, logoKey: hotel.logoKey } : null
  return (
    <SidebarProvider className={SHELL_VARS}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-3 focus:shadow-lg"
      >
        {t("skip")}
      </a>
      <AppSidebar me={me} current={current} hotels={hotels} activeHotelId={activeId} />
      <SidebarInset id="main" className="min-w-0">
        <header className="sticky top-0 z-30 border-b bg-background pt-safe">
          <TopBar me={me} hotelName={current?.name ?? null} bell={<InboxBell unread={unread} />} />
          {viewedId && hotel ? <ViewingBanner hotelId={viewedId} hotelName={hotel.displayName} /> : null}
        </header>
        <div className="mx-auto w-full max-w-6xl flex-1 pb-nav">{children}</div>
      </SidebarInset>
      <BottomTabs unread={unread} />
      <CommandPalette role={me.role} />
      <FeedbackDialog />
    </SidebarProvider>
  )
}
