"use client"

import { useEffect, useRef } from "react"
import { type ClearZone, createSky } from "./pixel-sky-grid"

const STEP_MS = 900
const PALETTE_VARS = ["--sky-1", "--sky-2", "--sky-3", "--sky-4", "--cloud"]

export interface PixelSkyCanvasProps {
  seed?: string
  cellSize?: number
  density?: number
  /** Keeps the middle white. Mark the text block with `data-sky-clear` (inside the sky's parent) and the zone follows its box. */
  clearCenter?: boolean
  fadeTop?: boolean
  animated?: boolean
}

/** Resolves any CSS color (oklch tokens included) to a little-endian RGBA word for ImageData. */
function readPalette(element: Element): Uint32Array {
  const style = getComputedStyle(element)
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  const out = new Uint32Array(PALETTE_VARS.length)
  PALETTE_VARS.forEach((name, i) => {
    if (!probe) return
    probe.clearRect(0, 0, 1, 1)
    probe.fillStyle = style.getPropertyValue(name).trim() || "#fff"
    probe.fillRect(0, 0, 1, 1)
    const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data
    out[i] = (255 << 24) | (b << 16) | (g << 8) | r
  })
  return out
}

function onIdle(run: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(run, { timeout: 1200 })
    return () => window.cancelIdleCallback(id)
  }
  const id = setTimeout(run, 200)
  return () => clearTimeout(id)
}

function motionAllowed(): boolean {
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  return !saveData && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** Client half of PixelSky: redraws the poster at the real cell size once idle, then steps the clouds. Default export so apps can load it with next/dynamic. */
export default function PixelSkyCanvas({
  seed,
  cellSize,
  density,
  clearCenter,
  fadeTop,
  animated = true,
}: PixelSkyCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const host = canvas?.parentElement
    const ctx = canvas?.getContext("2d")
    if (!canvas || !host || !ctx) return
    const sky = createSky(seed)
    let palette: Uint32Array | null = null
    let cols = 0
    let rows = 0
    let cell = 12
    let clear: ClearZone | undefined
    const target = clearCenter ? host.parentElement?.querySelector<HTMLElement>("[data-sky-clear]") : null
    let drift = 0
    let frame = 0
    let last = 0
    let visible = true

    const draw = (): void => {
      if (!cols || !rows || !palette) return
      const cells = sky({ cols, rows, density, clearCenter, clear, fadeTop, drift })
      const image = ctx.createImageData(cols, rows)
      const pixels = new Uint32Array(image.data.buffer)
      for (let i = 0; i < cells.length; i++) pixels[i] = palette[cells[i] ?? 0] ?? 0
      ctx.putImageData(image, 0, 0)
    }

    const measureClear = (): ClearZone | undefined => {
      // Phones keep the default ellipse: the text block is nearly full width there and would clear the whole sky.
      if (!target || host.clientWidth < 768) return undefined
      const box = target.getBoundingClientRect()
      const origin = canvas.getBoundingClientRect()
      return {
        cx: (box.left + box.width / 2 - origin.left) / cell,
        cy: (box.top + box.height / 2 - origin.top) / cell,
        rx: box.width / 2 / cell,
        ry: box.height / 2 / cell,
      }
    }

    const resize = (): void => {
      cell = cellSize ?? (Number.parseFloat(getComputedStyle(host).getPropertyValue("--sky-cell")) || 12)
      cols = Math.ceil(host.clientWidth / cell)
      rows = Math.ceil(host.clientHeight / cell)
      canvas.width = cols
      canvas.height = rows
      canvas.style.width = `${cols * cell}px`
      canvas.style.height = `${rows * cell}px`
      clear = measureClear()
      draw()
    }

    const tick = (now: number): void => {
      frame = requestAnimationFrame(tick)
      if (now - last < STEP_MS) return
      last = now
      drift += 1
      draw()
    }
    const play = (): void => {
      if (!frame && visible && animated && motionAllowed()) frame = requestAnimationFrame(tick)
    }
    const pause = (): void => {
      cancelAnimationFrame(frame)
      frame = 0
    }

    const resizeObserver = new ResizeObserver(resize)
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      if (visible) play()
      else pause()
    })
    const cancelIdle = onIdle(() => {
      palette = readPalette(host)
      resize()
      draw()
      canvas.dataset.ready = ""
      resizeObserver.observe(host)
      if (target) resizeObserver.observe(target)
      intersection.observe(host)
      play()
    })
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onMotion = (): void => (motion.matches ? pause() : play())
    motion.addEventListener("change", onMotion)

    return () => {
      cancelIdle()
      pause()
      resizeObserver.disconnect()
      intersection.disconnect()
      motion.removeEventListener("change", onMotion)
    }
  }, [seed, cellSize, density, clearCenter, fadeTop, animated])

  return (
    <canvas
      ref={ref}
      className="shrink-0 opacity-0 transition-opacity duration-600 ease-out [image-rendering:pixelated] data-ready:opacity-100"
    />
  )
}
