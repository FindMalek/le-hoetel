import { mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import type { Locator, Page } from "@playwright/test"

const OUT = fileURLToPath(new URL("../../docs/assets/guide/", import.meta.url))
const MARK = "#e5484d"
const PAD = 8

export type Side = "top" | "bottom" | "left" | "right"
/** The element to outline and the side its number and arrow come from. Numbers follow the array order. */
export type Callout = [target: Locator, side?: Side]

export interface ShotOptions {
  /**
   * Crop to the height these cover, without the sidebar and top bar. A dialog is cropped on all sides.
   * Without it the shot is the viewport.
   */
  area?: Locator[]
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

async function boxOf(target: Locator): Promise<Box> {
  await target.waitFor({ state: "visible", timeout: 10_000 })
  return target.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x: x + scrollX, y: y + scrollY, width, height }
  })
}

async function mark(page: Page, marks: { box: Box; side: Side }[]): Promise<void> {
  await page.evaluate(
    ({ marks, color }) => {
      const NS = "http://www.w3.org/2000/svg"
      const svg = document.createElementNS(NS, "svg")
      svg.id = "guide-marks"
      const { scrollWidth, scrollHeight } = document.documentElement
      svg.setAttribute("width", String(scrollWidth))
      svg.setAttribute("height", String(scrollHeight))
      svg.style.cssText = "position:absolute;left:0;top:0;z-index:2147483647;pointer-events:none;direction:ltr"
      const add = (tag: string, attributes: Record<string, string | number>) => {
        const node = document.createElementNS(NS, tag)
        for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value))
        svg.append(node)
        return node
      }
      const R = 12
      const ARROW = 22
      marks.forEach(({ box, side }, index) => {
        const x = box.x - 4
        const y = box.y - 4
        const width = box.width + 8
        const height = box.height + 8
        add("rect", { x, y, width, height, rx: 10, fill: "none", stroke: color, "stroke-width": 2 })
        const [tipX, tipY, dx, dy] = {
          top: [x + width / 2, y - 3, 0, -1],
          bottom: [x + width / 2, y + height + 3, 0, 1],
          left: [x - 3, y + height / 2, -1, 0],
          right: [x + width + 3, y + height / 2, 1, 0],
        }[side] as [number, number, number, number]
        const cx = tipX + dx * (ARROW + R)
        const cy = tipY + dy * (ARROW + R)
        add("line", {
          x1: cx - dx * R,
          y1: cy - dy * R,
          x2: tipX + dx * 6,
          y2: tipY + dy * 6,
          stroke: color,
          "stroke-width": 2.5,
        })
        const head = [
          [tipX, tipY],
          [tipX + dx * 9 - dy * 5, tipY + dy * 9 - dx * 5],
          [tipX + dx * 9 + dy * 5, tipY + dy * 9 + dx * 5],
        ]
        add("polygon", { points: head.join(" "), fill: color })
        add("circle", { cx, cy, r: R, fill: color, stroke: "#fff", "stroke-width": 2 })
        const label = add("text", {
          x: cx,
          y: cy + 4.5,
          fill: "#fff",
          "font-size": 13,
          "font-weight": 700,
          "font-family": "system-ui, sans-serif",
          "text-anchor": "middle",
        })
        label.textContent = String(index + 1)
      })
      document.body.append(svg)
    },
    { marks, color: MARK },
  )
}

/** The page as it is now with its numbered callouts, as png. */
export async function capture(page: Page, callouts: Callout[], { area }: ShotOptions = {}): Promise<Buffer> {
  await page.evaluate(async () => {
    await document.fonts.ready
    scrollTo(0, 0)
  })
  const dialog = (await page.getByRole("dialog").count()) > 0
  const chrome =
    area && !dialog
      ? await page.addStyleTag({
          content: '[data-slot="sidebar"], [data-slot="sidebar-inset"] > header { display: none !important }',
        })
      : null
  await page.waitForTimeout(400)
  const marks: { box: Box; side: Side }[] = []
  for (const [target, side = "top"] of callouts) marks.push({ box: await boxOf(target), side })
  const clip = area && (await clipOf(page, area, marks, dialog))
  await mark(page, marks)
  const png = await page.screenshot({ animations: "disabled", caret: "hide", ...(clip && { clip, fullPage: true }) })
  await page.evaluate(() => document.getElementById("guide-marks")?.remove())
  await chrome?.evaluate((style) => (style as Element).remove())
  return png
}

async function clipOf(page: Page, area: Locator[], marks: { box: Box }[], dialog: boolean): Promise<Box> {
  const boxes = [...(await Promise.all(area.map(boxOf))), ...marks.map((entry) => entry.box)]
  const size = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }))
  // room for the badges that stick out of what they point at
  const gap = marks.length ? 52 : 24
  const left = dialog ? Math.max(0, Math.min(...boxes.map((box) => box.x)) - gap) : 0
  const right = dialog ? Math.min(size.width, Math.max(...boxes.map((box) => box.x + box.width)) + gap) : size.width
  const top = Math.max(0, Math.min(...boxes.map((box) => box.y)) - gap)
  const bottom = Math.min(size.height, Math.max(...boxes.map((box) => box.y + box.height)) + gap)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** Puts one or more captures side by side in a soft light frame and writes `<name>.webp` for the docs. */
export async function frame(page: Page, name: string, shots: Buffer[]): Promise<void> {
  const studio = await page.context().browser()!.newPage()
  const data = await studio.evaluate(
    async ({ sources, pad }) => {
      const images = await Promise.all(
        sources.map(async (source) => createImageBitmap(await (await fetch(source)).blob())),
      )
      // phones are shot at 2x and desktops at 1.5x: never wider than twice the docs column
      const gap = pad * 3
      const full = images.reduce((sum, image) => sum + image.width, 0) + gap * (images.length - 1) + pad * 2
      const scale = Math.min(1, 1600 / full)
      const canvas = document.createElement("canvas")
      canvas.width = Math.round(full * scale)
      canvas.height = Math.round((Math.max(...images.map((image) => image.height)) + pad * 2) * scale)
      const ctx = canvas.getContext("2d")!
      ctx.scale(scale, scale)
      ctx.imageSmoothingQuality = "high"
      ctx.fillStyle = "#eef4fb"
      ctx.fillRect(0, 0, full, canvas.height / scale)
      let x = pad
      for (const image of images) {
        const outline = () => {
          ctx.beginPath()
          ctx.roundRect(x, pad, image.width, image.height, 18)
        }
        ctx.save()
        ctx.shadowColor = "rgba(30, 58, 95, 0.16)"
        ctx.shadowBlur = 22
        ctx.shadowOffsetY = 4
        ctx.fillStyle = "#fff"
        outline()
        ctx.fill()
        ctx.restore()
        ctx.save()
        outline()
        ctx.clip()
        ctx.drawImage(image, x, pad)
        ctx.restore()
        ctx.strokeStyle = "#d5e2f0"
        ctx.lineWidth = 2
        outline()
        ctx.stroke()
        x += image.width + gap
      }
      return canvas.toDataURL("image/webp", 0.8)
    },
    { sources: shots.map((shot) => `data:image/png;base64,${shot.toString("base64")}`), pad: PAD * 3 },
  )
  await studio.close()
  await mkdir(OUT, { recursive: true })
  await writeFile(`${OUT}${name}.webp`, Buffer.from(data.split(",")[1]!, "base64"))
}

export async function shot(page: Page, name: string, callouts: Callout[], options?: ShotOptions): Promise<void> {
  await frame(page, name, [await capture(page, callouts, options)])
}
