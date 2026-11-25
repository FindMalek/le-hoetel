import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@le-hoetel/ui/components/card"

export interface PreviewLabels {
  title: string
  code: string
  show: string
  validFrom: string
  validBetween: string
}

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")

/** The offer page as the guest sees it (the dashboard already wears the hotel's colors) and a sample code instead of a real QR. */
export function OfferPreview({
  hotelName,
  offer,
  labels,
}: {
  hotelName: string
  offer: { title: string; text: string; validFrom: string; validUntil: string }
  labels: PreviewLabels
}) {
  return (
    <section aria-label={labels.title} className="grid gap-2">
      <h3 className="font-medium text-muted-foreground text-sm">{labels.title}</h3>
      <div>
        <Card>
          <CardHeader>
            <p className="font-medium text-muted-foreground text-sm">{hotelName}</p>
            <CardTitle className="text-xl">{offer.title || "…"}</CardTitle>
            {offer.text ? <CardDescription>{offer.text}</CardDescription> : null}
          </CardHeader>
          <CardContent className="grid gap-3">
            <div
              aria-hidden
              className="mx-auto grid aspect-square w-32 place-items-center border-2 border-primary border-dashed"
            >
              <span className="text-primary text-xs">QR</span>
            </div>
            <p className="text-center">
              <span className="block text-muted-foreground text-xs">{labels.code}</span>
              <bdi dir="ltr" className="font-mono font-semibold tracking-widest">
                AB3D-EF7H
              </bdi>
            </p>
            <p className="text-center text-muted-foreground text-xs">{labels.show}</p>
            {offer.validFrom ? (
              <p className="text-center text-muted-foreground text-xs">
                {offer.validUntil
                  ? fill(labels.validBetween, { from: offer.validFrom, until: offer.validUntil })
                  : fill(labels.validFrom, { from: offer.validFrom })}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
