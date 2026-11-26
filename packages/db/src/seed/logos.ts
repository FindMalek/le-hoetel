import { DEMO_HOTEL_SLUGS } from "@ritorno/common/demo"
import { hotelPublicPrefix, type Storage } from "@ritorno/storage"
import { demoHotelId } from "./hotels"

/** Uploads the demo logos and says which key each hotel got. A storage that refuses only costs the logos. */
export async function uploadDemoLogos(storage: Pick<Storage, "prefix" | "put">): Promise<Map<string, string>> {
  const keys = new Map<string, string>()
  for (const slug of DEMO_HOTEL_SLUGS) {
    const hotelId = demoHotelId(slug)
    const key = `${hotelPublicPrefix(storage, hotelId)}logo-demo.png`
    try {
      const png = await Bun.file(new URL(`./logos/${slug}.png`, import.meta.url)).arrayBuffer()
      await storage.put(key, png, "image/png")
      keys.set(hotelId, key)
    } catch {
      console.warn("[seed] a demo logo could not be uploaded", { hotelId })
    }
  }
  return keys
}
