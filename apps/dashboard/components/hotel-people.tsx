import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { getLocale, getTranslations } from "next-intl/server"
import { AdminInvitationActions } from "@/components/admin-invitations"

interface HotelPeopleProps {
  /** The app admin's resend, revoke and copy link on each pending invitation. Off where the list is read only. */
  manage?: boolean
  hotel: {
    id: string
    timezone: string
    members: { userId: string; name: string; email: string; role: string }[]
    invitations: { id: string; email: string; role: string | null; expiresAt: Date }[]
  }
}

/** A hotel's members and pending invitations as the app admin reads them (`admin.hotels.get`). */
export async function HotelPeople({ hotel, manage }: HotelPeopleProps) {
  const [t, locale] = await Promise.all([getTranslations("adminHotel"), getLocale()])
  if (hotel.members.length === 0 && hotel.invitations.length === 0) {
    return <p className="text-muted-foreground text-small">{t("noPeople")}</p>
  }
  return (
    <ul className="flex flex-col divide-y rounded-card border">
      {hotel.members.map((person) => {
        const role = person.role.split(",")[0] ?? "staff"
        return (
          <li key={person.userId} className="flex items-center justify-between gap-3 p-4">
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{person.name}</span>
              <span className="truncate text-caption text-muted-foreground" dir="ltr">
                {person.email}
              </span>
            </span>
            <StatusBadge tone={role === "owner" ? "info" : "neutral"}>
              {t.has(`roles.${role}` as never) ? t(`roles.${role}` as never) : role}
            </StatusBadge>
          </li>
        )
      })}
      {hotel.invitations.map((invite) => (
        <li key={invite.id} className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span className="truncate" dir="ltr">
                {invite.email}
              </span>
              <span className="text-caption text-muted-foreground">
                {t.has(`roles.${invite.role}` as never) ? `${t(`roles.${invite.role}` as never)} · ` : null}
                {t("inviteExpires", { date: formatDate(invite.expiresAt, locale, hotel.timezone) })}
              </span>
            </span>
            <StatusBadge tone="warning">{t("invited")}</StatusBadge>
          </div>
          {manage ? <AdminInvitationActions hotelId={hotel.id} invitation={invite} /> : null}
        </li>
      ))}
    </ul>
  )
}
