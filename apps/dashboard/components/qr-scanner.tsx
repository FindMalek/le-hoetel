"use client"

import { useEffect, useRef } from "react"

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
type DetectorConstructor = new (options: { formats: string[] }) => Detector

const detectorConstructor = () => (globalThis as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector

/** Whether this browser can read QR codes from the camera. Safari and Firefox can't yet: the screen falls back to typing. */
export const canScanQr = (): boolean => Boolean(detectorConstructor() && navigator.mediaDevices?.getUserMedia)

function release(stream: MediaStream | undefined) {
  for (const track of stream?.getTracks() ?? []) track.stop()
}

/** The rear camera, read for a QR code until one is found; the camera is released when this unmounts. */
export function QrScanner({
  onCode,
  onFail,
  label,
}: {
  onCode: (code: string) => void
  onFail: () => void
  label: string
}) {
  const video = useRef<HTMLVideoElement>(null)
  const callbacks = useRef({ onCode, onFail })
  callbacks.current = { onCode, onFail }

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let stream: MediaStream | undefined
    const Detector = detectorConstructor()

    async function start() {
      try {
        if (!Detector) throw new Error("no detector")
        const detector = new Detector({ formats: ["qr_code"] })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        if (stopped || !video.current) return release(stream)
        video.current.srcObject = stream
        await video.current.play()
        const scan = async () => {
          if (stopped || !video.current) return
          const [found] = await detector.detect(video.current).catch(() => [])
          if (found?.rawValue) return callbacks.current.onCode(found.rawValue)
          timer = setTimeout(scan, 250)
        }
        scan()
      } catch {
        if (!stopped) callbacks.current.onFail()
      }
    }
    start()
    return () => {
      stopped = true
      clearTimeout(timer)
      release(stream)
    }
  }, [])

  return (
    <video
      ref={video}
      aria-label={label}
      playsInline
      muted
      className="size-full object-cover"
    />
  )
}
