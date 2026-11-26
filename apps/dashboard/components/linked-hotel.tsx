"use client"

import { orgClient } from "@ritorno/auth/orgs"
import { Button } from "@ritorno/ui/components/button"
import { PageState } from "@ritorno/ui/components/page-state"
import { HotelIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

/**
 * A link from an email names a hotel that is not the one on screen. Nothing of the other hotel is editable here:
 * a member switches first (better-auth checks the membership again), anyone else only learns it is not theirs.
 */
export function LinkedHotel({ target, current }: { target: { id: string; name: string } | null; current?: string }) {
  const t = useTranslations("hotelSettings.linked")
  const tHotel = useTranslations("hotel")
  const [switching, setSwitching] = useState(false)

  if (!target) {
    return <PageState kind="forbidden" title={t("unknown")} description={t("unknownHint")} />
  }

  async function open(organizationId: string) {
    setSwitching(true)
    const { error } = await orgClient.organization.setActive({ organizationId })
    if (error) {
      setSwitching(false)
      return void toast.error(error.message ?? tHotel("switchError"))
    }
    // A full load, so the url's anchor scrolls to its section.
    window.location.reload()
  }

  return (
    <PageState
      kind="empty"
      icon={<HotelIcon />}
      title={t("title", { hotel: target.name })}
      description={current ? t("viewing", { hotel: current }) : undefined}
      action={
        <Button loading={switching} onClick={() => open(target.id)}>
          {t("switch", { hotel: target.name })}
        </Button>
      }
    />
  )
}
