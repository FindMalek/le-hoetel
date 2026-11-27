import type { HotelLanguage } from "@ritorno/common/hotel"
import type { SignUpPerk } from "@ritorno/common/schemas"
import { buttonVariants } from "@ritorno/ui/components/button"
import { cn } from "@ritorno/ui/lib/utils"
import { OfferCodeCard } from "./offer-code-card"

export interface SignUpPerkCopy {
  code: string
  qrAlt: string
  validFrom: string
  validBetween: string
  show: string
  save: string
  open: string
  returning: string
}

export function SignUpPerkCard({
  perk,
  language,
  copy,
}: {
  perk: SignUpPerk
  language: HotelLanguage
  copy: SignUpPerkCopy
}) {
  const day = new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "Africa/Tunis" })
  const validity = (perk.validUntil ? copy.validBetween : copy.validFrom)
    .replace("{from}", day.format(perk.validFrom))
    .replace("{until}", perk.validUntil ? day.format(perk.validUntil) : "")
  return (
    <section className="grid w-full gap-4">
      <div className="grid gap-1">
        <h3 className="text-balance font-semibold text-xl">
          <bdi>{perk.title}</bdi>
        </h3>
        {perk.text ? (
          <p className="text-pretty text-muted-foreground">
            <bdi>{perk.text}</bdi>
          </p>
        ) : null}
      </div>
      <OfferCodeCard
        code={perk.code}
        qrSvg={perk.qrSvg}
        label={copy.code}
        qrAlt={copy.qrAlt.replace("{code}", perk.code)}
      />
      <div className="grid gap-1">
        <p className="font-medium">{copy.show}</p>
        <p className="text-muted-foreground text-sm">{validity}</p>
      </div>
      <div className="grid gap-2">
        <a href={perk.url} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11 w-full")}>
          {copy.open}
        </a>
        <p className="text-muted-foreground text-sm">{copy.save}</p>
        <p className="text-muted-foreground text-sm">{copy.returning}</p>
      </div>
    </section>
  )
}
