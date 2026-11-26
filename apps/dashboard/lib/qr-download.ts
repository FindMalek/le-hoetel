import { qrFileName } from "@ritorno/common/qr"
import type { CaptureSource } from "@ritorno/common/schemas"
import { zipSync } from "fflate"

export type ImageFormat = "png" | "svg"

/** Wide enough for a 9 cm print at 300 dpi. */
const PNG_WIDTH = 1080
const PAINT = ["fill", "stroke", "font-family", "font-weight"] as const

const dataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** A file has no stylesheet and no session: colors and fonts are written on each node, the logo goes inside. */
async function standalone(art: SVGSVGElement): Promise<{ svg: string; height: number }> {
  const copy = art.cloneNode(true) as SVGSVGElement
  const from = art.querySelectorAll("text, rect, path")
  copy.querySelectorAll("text, rect, path").forEach((node, index) => {
    const style = getComputedStyle(from[index]!)
    for (const name of PAINT) node.setAttribute(name, style.getPropertyValue(name))
  })
  for (const node of copy.querySelectorAll("*")) node.removeAttribute("class")
  for (const image of copy.querySelectorAll("image")) {
    const href = image.getAttribute("href")
    if (!href || href.startsWith("data:")) continue
    const response = await fetch(href)
    if (!response.ok) throw new Error(`logo ${response.status}`)
    image.setAttribute("href", await dataUrl(await response.blob()))
  }
  const { width, height } = art.viewBox.baseVal
  const tall = Math.round((PNG_WIDTH * height) / width)
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  copy.setAttribute("width", String(PNG_WIDTH))
  copy.setAttribute("height", String(tall))
  return { svg: new XMLSerializer().serializeToString(copy), height: tall }
}

async function png({ svg, height }: { svg: string; height: number }): Promise<Blob> {
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  const canvas = document.createElement("canvas")
  canvas.width = PNG_WIDTH
  canvas.height = height
  canvas.getContext("2d")?.drawImage(image, 0, 0, PNG_WIDTH, height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("png"))), "image/png"),
  )
}

function save(name: string, blob: Blob) {
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000)
}

/** One image per code with the art as printed: a single file as is, several in one zip. */
export async function downloadArt(
  art: { source: CaptureSource; location: string | null; node: SVGSVGElement }[],
  format: ImageFormat,
  zipName: string,
) {
  const files: Record<string, Uint8Array> = {}
  for (const { source, location, node } of art) {
    const drawn = await standalone(node)
    const blob = format === "png" ? await png(drawn) : new Blob([drawn.svg], { type: "image/svg+xml" })
    const name = qrFileName(source, location, format)
    if (art.length === 1) return save(name, blob)
    files[name] = new Uint8Array(await blob.arrayBuffer())
  }
  // images are already compressed: store them
  save(zipName, new Blob([new Uint8Array(zipSync(files, { level: 0 }))], { type: "application/zip" }))
}
