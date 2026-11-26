import { QR_LOGO_RATIO } from "@ritorno/common/qr"

const PAD = QR_LOGO_RATIO * 100
const PAD_AT = (100 - PAD) / 2
const INSET = 1.5

/**
 * A code with the hotel's mark in the middle: its logo, or its first letter on its primary color. The code must be made
 * with error level H, and the pad must stay `QR_LOGO_RATIO` wide (the api test decodes at that size).
 */
export function QrMark({
  svg,
  hotel,
  label,
  ...props
}: {
  svg: string
  hotel: { displayName: string; logoSrc: string | null }
  label: string
} & Omit<React.SVGProps<SVGSVGElement>, "viewBox">) {
  const mark = { x: PAD_AT + INSET, y: PAD_AT + INSET, width: PAD - 2 * INSET, height: PAD - 2 * INSET }
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={label} {...props}>
      <image href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} width="100" height="100" />
      <rect x={PAD_AT} y={PAD_AT} width={PAD} height={PAD} rx="2" className="fill-white" />
      {hotel.logoSrc ? (
        <image href={hotel.logoSrc} {...mark} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <>
          <rect {...mark} rx="2" className="fill-primary" />
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={mark.height * 0.65}
            className="fill-primary-foreground font-semibold"
          >
            {Array.from(hotel.displayName.trim())[0]?.toUpperCase()}
          </text>
        </>
      )}
    </svg>
  )
}
