import type { Metadata } from "next"
import { InvitationCard } from "@/components/invitation-card"

export const metadata: Metadata = { title: "Invitation" }

export default async function AcceptInvitationPage({ params }: PageProps<"/accept-invitation/[id]">) {
  const { id } = await params
  return <InvitationCard id={id} />
}
