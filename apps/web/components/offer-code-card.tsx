/** The QR and the typed code a guest shows at the desk. */
export function OfferCodeCard(props: { code: string; qrSvg: string; label: string; qrAlt: string }) {
  return (
    <div className="grid w-full justify-items-center gap-4 rounded-card border p-5">
      {/* biome-ignore lint/performance/noImgElement: an inline svg made by the api for this code */}
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(props.qrSvg)}`}
        alt={props.qrAlt}
        className="aspect-square w-full max-w-60"
      />
      <p className="grid gap-1 text-center">
        <span className="text-muted-foreground text-small">{props.label}</span>
        <bdi dir="ltr" className="font-mono font-semibold text-2xl tracking-widest">
          {props.code}
        </bdi>
      </p>
    </div>
  )
}
