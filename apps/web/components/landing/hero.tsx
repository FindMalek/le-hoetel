import { Display } from "@ritorno/ui/brand/display"
import { PixelSky } from "@ritorno/ui/brand/pixel-sky"
import { buttonVariants } from "@ritorno/ui/components/button"
import { cn } from "@ritorno/ui/lib/utils"
import { getTranslations } from "next-intl/server"

export async function Hero() {
  const t = await getTranslations("landing.hero")
  return (
    <section
      id="top"
      className="relative isolate flex min-h-svh flex-col items-center justify-center px-4 pt-28 pb-44 text-center md:pt-32 md:pb-52"
    >
      <PixelSky clearCenter className="-z-10" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 grid [--sky-cell:8px] md:[--sky-cell:12px]">
        <span className="h-[calc(var(--sky-cell)*2)] bg-dither-25" />
        <span className="h-[calc(var(--sky-cell)*2)] bg-dither-50" />
        <span className="h-[calc(var(--sky-cell)*2)] bg-dither-75" />
      </div>
      <div data-sky-clear className="flex max-w-5xl flex-col items-center">
        <Display size="xl" reveal className="max-w-5xl">
          {t.rich("title", { em: (chunks) => <em>{chunks}</em>, br: () => <br className="max-lg:hidden" /> })}
        </Display>
        <p className="mt-6 max-w-md text-pretty text-lead text-muted-foreground">{t("lead")}</p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-2 sm:w-auto sm:max-w-none sm:flex-row">
          <a href="#demo" className={cn(buttonVariants({ size: "lg" }), "px-6")}>
            {t("cta")}
          </a>
          <a href="#how" className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "px-6")}>
            {t("secondary")}
          </a>
        </div>
      </div>
    </section>
  )
}
