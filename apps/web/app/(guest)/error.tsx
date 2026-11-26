"use client"

import { GuestError } from "@/components/guest-error"

export default function GuestErrorBoundary(props: { error: Error; reset: () => void }) {
  return <GuestError {...props} />
}
