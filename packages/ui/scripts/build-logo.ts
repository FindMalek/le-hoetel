// Rasterizes `assets/logo/*.svg` into the PNG and ICO icons and copies them into each app. Run with `pnpm logo:build`.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const ASSETS = join(ROOT, "assets/logo")
const APPS = join(ROOT, "../../apps")

const svg = (name: string): Promise<string> => readFile(join(ASSETS, name), "utf8")

/** Renders at the target size instead of downscaling, so the dither cells land on whole pixels. */
function png(source: string, width: number, height = width): Promise<Buffer> {
  const sized = source.replace("<svg ", `<svg width="${width}" height="${height}" `)
  return sharp(Buffer.from(sized)).png({ compressionLevel: 9 }).toBuffer()
}

/** ICO with PNG entries: a 6 byte header, a 16 byte entry per image, then the images. */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i
    header.writeUInt8(size % 256, at)
    header.writeUInt8(size % 256, at + 1)
    header.writeUInt16LE(1, at + 4)
    header.writeUInt16LE(32, at + 6)
    header.writeUInt32LE(data.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...images.map((image) => image.data)])
}

async function main(): Promise<void> {
  const [mark, small, maskable, lockup] = await Promise.all([
    svg("logo-mark.svg"),
    svg("logo-mark-small.svg"),
    svg("logo-mark-maskable.svg"),
    svg("logo-lockup.svg"),
  ])
  // iOS masks its icon itself, so it gets square corners. The maskable svg is square with the R inside the 80% safe zone.
  const square = mark.replace(/ rx="[\d.]+"/, "")
  const lockupWidth = Number(/viewBox="0 0 ([\d.]+) /.exec(lockup)?.[1])
  const ogLockupHeight = 120
  const ogLockup = await png(lockup, Math.round((lockupWidth / 100) * ogLockupHeight), ogLockupHeight)

  const files: Record<string, Buffer> = {
    "favicon.ico": ico([
      { size: 16, data: await png(small, 16) },
      { size: 32, data: await png(small, 32) },
      { size: 48, data: await png(small, 48) },
    ]),
    "apple-touch-icon.png": await png(square, 180),
    "icon-192.png": await png(mark, 192),
    "icon-512.png": await png(mark, 512),
    "icon-maskable-512.png": await png(maskable, 512),
    "email-logo.png": await png(mark, 64),
    "og-base.png": await sharp({ create: { width: 1200, height: 630, channels: 4, background: "#ffffff" } })
      .composite([{ input: ogLockup, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toBuffer(),
  }
  await Promise.all(Object.entries(files).map(([name, data]) => writeFile(join(ASSETS, name), data)))

  const copies: [string, string][] = []
  for (const app of ["web", "dashboard", "docs"]) {
    copies.push(
      ["logo-mark-small.svg", `${app}/app/icon.svg`],
      ["favicon.ico", `${app}/app/favicon.ico`],
      ["apple-touch-icon.png", `${app}/app/apple-icon.png`],
    )
  }
  for (const app of ["web", "dashboard"]) {
    for (const name of ["icon-192.png", "icon-512.png", "icon-maskable-512.png"]) {
      copies.push([name, `${app}/public/brand/${name}`])
    }
  }
  copies.push(["email-logo.png", "dashboard/public/brand/email-logo.png"])
  for (const [from, to] of copies) {
    await mkdir(dirname(join(APPS, to)), { recursive: true })
    await copyFile(join(ASSETS, from), join(APPS, to))
  }
}

await main()
