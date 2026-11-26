import { cn } from "@ritorno/ui/lib/utils"
import type { CSSProperties } from "react"
import PixelSkyCanvas, { type PixelSkyCanvasProps } from "./pixel-sky-canvas"
import { SKY_POSTER, SKY_POSTER_CLEAR } from "./pixel-sky-poster"

export interface PixelSkyProps extends PixelSkyCanvasProps {
  className?: string
}

/**
 * Dithered pixel sky that fills its positioned parent. The poster PNG (default seed and density) paints with the HTML, so the
 * page never waits for JS; the canvas then redraws it at the real cell size and drifts the clouds. Art only, never mirrored in RTL.
 */
export function PixelSky({ className, cellSize, clearCenter = false, fadeTop = false, ...canvas }: PixelSkyProps) {
  const style = {
    // The faded sky lives in small cards, below the fold: no poster, the canvas fades in on white.
    backgroundImage: fadeTop ? undefined : `url(${clearCenter ? SKY_POSTER_CLEAR : SKY_POSTER})`,
    ...(cellSize ? { "--sky-cell": `${cellSize}px` } : {}),
  } as CSSProperties
  return (
    <div
      aria-hidden
      data-slot="pixel-sky"
      className={cn(
        "pointer-events-none absolute inset-0 grid select-none place-items-center overflow-hidden bg-center bg-cover [--sky-cell:8px] [image-rendering:pixelated] md:[--sky-cell:12px]",
        className,
      )}
      style={style}
    >
      <PixelSkyCanvas cellSize={cellSize} clearCenter={clearCenter} fadeTop={fadeTop} {...canvas} />
    </div>
  )
}
