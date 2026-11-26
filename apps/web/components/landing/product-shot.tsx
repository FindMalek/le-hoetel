import { BrowserFrame, PhoneFrame } from "@ritorno/ui/brand/device-frame"
import { cn } from "@ritorno/ui/lib/utils"
import { getTranslations } from "next-intl/server"
import { CaptureMockup, DashboardMockup } from "./mockups"
import { CONTAINER } from "./section"

/** Glass rods of light behind the frames: thin highlight lines over a sky gradient, faded at the edges. */
function Streaks({ className }: { className: string }) {
  return <div aria-hidden className={cn("bg-light-streaks", className)} />
}

export async function ProductShot() {
  const t = await getTranslations("landing.shot")
  return (
    <section aria-label={t("title")} className="relative flow-root bg-canvas pb-8 md:pb-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <Streaks className="absolute -start-40 top-24 h-[36rem] w-[44rem] opacity-80 blur-[1px] max-md:hidden" />
        <Streaks className="absolute -end-48 top-0 h-[26rem] w-[48rem] md:h-[40rem] opacity-70 blur-[1px]" />
      </div>
      <div className={`${CONTAINER} relative -mt-36 md:-mt-40`}>
        <div className="relative md:pe-20 lg:pe-32">
          <BrowserFrame label={t("browser")} url="app.ritorno.co" className="hidden md:block">
            <DashboardMockup />
          </BrowserFrame>
          <PhoneFrame
            label={t("phone")}
            className="mx-auto w-64 md:absolute md:end-0 md:top-24 md:w-52 lg:top-28 lg:w-64"
          >
            <CaptureMockup />
          </PhoneFrame>
        </div>
      </div>
    </section>
  )
}
