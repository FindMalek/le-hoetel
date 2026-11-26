"use client"

import { Button } from "@ritorno/ui/components/button"
import { PrinterIcon } from "lucide-react"

/** Waits for the Arabic font and the logo, else the first print can go out with a fallback font or a blank logo. */
async function print() {
  await document.fonts.ready
  // `document.images` misses the logos drawn inside an svg
  const drawn = [...document.querySelectorAll("svg image")].map((element) =>
    Object.assign(new Image(), { src: element.getAttribute("href") }),
  )
  await Promise.all([...document.images, ...drawn].map((image) => image.decode().catch(() => undefined)))
  window.print()
}

export function QrKitPrintButton({ label }: { label: string }) {
  return (
    <Button size="lg" className="min-h-touch" onClick={print}>
      <PrinterIcon data-icon="inline-start" />
      {label}
    </Button>
  )
}
