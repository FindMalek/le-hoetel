"use client"

import { orgClient } from "@ritorno/auth/orgs"
import { Badge } from "@ritorno/ui/components/badge"
import { Button } from "@ritorno/ui/components/button"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import { type DataColumn, DataTable } from "@ritorno/ui/components/data-table"
import { EmptyState } from "@ritorno/ui/components/empty-state"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Input } from "@ritorno/ui/components/input"
import { ListSkeleton } from "@ritorno/ui/components/loading-state"
import { RadioGroup, RadioGroupItem } from "@ritorno/ui/components/radio-group"
import { Section } from "@ritorno/ui/components/section"
import { RotateCwIcon, SendIcon, UsersIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { useForm } from "@/lib/use-form"
import { FormField } from "./form-field"
import { LocalDate } from "./local-date"
import { NativeSelect } from "./native-select"

const ASSIGNABLE = ["manager", "staff"] as const
type Assignable = (typeof ASSIGNABLE)[number]
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Member = {
  id: string
  userId: string
  role: string
  user: { name: string; email: string }
}

const rolesOf = (role: string): string[] => role.split(",").map((value) => value.trim())
const topRole = (role: string): string => ["owner", "manager", "staff"].find((r) => rolesOf(role).includes(r)) ?? role

function RoleHelp() {
  const t = useTranslations("team")
  return (
    <dl className="flex flex-col gap-3 text-sm">
      {(["owner", "manager", "staff"] as const).map((role) => (
        <div key={role} className="flex flex-col gap-0.5">
          <dt className="font-medium">{t(`roles.${role}`)}</dt>
          <dd className="text-muted-foreground">{t(`roleHelp.${role}`)}</dd>
        </div>
      ))}
    </dl>
  )
}

function InviteForm({ onSent }: { onSent: () => void }) {
  const t = useTranslations("team")
  const [role, setRole] = useState<Assignable>("staff")
  const [pending, setPending] = useState(false)
  const form = useForm({ email: "" }, (v) => (EMAIL.test(v.email.trim()) ? {} : { email: t("errors.email") }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.submit()) return
    setPending(true)
    const email = form.values.email.trim().toLowerCase()
    const { error } = await orgClient.organization.inviteMember({ email, role })
    setPending(false)
    if (error) return void toast.error(error.message ?? t("errors.generic"))
    toast.success(t("invited", { email }))
    form.reset({ email: "" })
    onSent()
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <FormField id="invite-email" label={t("email")} hint={t("emailHint")} error={form.error("email")}>
        {(aria) => (
          <Input
            {...aria}
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="off"
            enterKeyHint="send"
            placeholder="name@hotel.com"
            value={form.values.email}
            onChange={(event) => form.set("email", event.target.value)}
            onBlur={() => form.blur("email")}
          />
        )}
      </FormField>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium text-sm">{t("role")}</legend>
        <RadioGroup value={role} onValueChange={(next) => setRole(next as Assignable)} className="gap-2">
          {ASSIGNABLE.map((value) => (
            <label
              key={value}
              htmlFor={`role-${value}`}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5"
            >
              <RadioGroupItem id={`role-${value}`} value={value} className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-sm">{t(`roles.${value}`)}</span>
                <span className="text-muted-foreground text-sm">{t(`roleHelp.${value}`)}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <Button type="submit" loading={pending}>
        <SendIcon data-icon="inline-start" className="rtl:-scale-x-100" />
        {t("sendInvite")}
      </Button>
    </form>
  )
}

export function TeamBoard({ meId, canManage }: { meId: string; canManage: boolean }) {
  const t = useTranslations("team")
  const router = useRouter()
  const { data: active, isPending, error, refetch } = orgClient.useActiveOrganization()
  const [removing, setRemoving] = useState<Member | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  /** Runs a better-auth call: shows its error, refreshes the lists on success. */
  async function run(key: string, call: Promise<{ error: { message?: string } | null }>, done?: string) {
    setBusy(key)
    const { error: failed } = await call
    setBusy(null)
    if (failed) return void toast.error(failed.message ?? t("errors.generic"))
    if (done) toast.success(done)
    await refetch()
    router.refresh()
  }

  if (isPending) return <ListSkeleton rows={4} label={t("loading")} />
  if (error || !active) {
    return (
      <InlineAlert
        tone="error"
        title={t("loadFailed")}
        action={
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RotateCwIcon data-icon="inline-start" />
            {t("retry")}
          </Button>
        }
      >
        {t("loadFailedHint")}
      </InlineAlert>
    )
  }

  const members = active.members as Member[]
  const pending = active.invitations.filter((invitation) => invitation.status === "pending")

  const roleCell = (member: Member) => {
    const role = topRole(member.role)
    if (!canManage || role === "owner" || member.userId === meId) {
      return <Badge variant={role === "owner" ? "default" : "secondary"}>{t(`roles.${role as "owner"}`)}</Badge>
    }
    return (
      <NativeSelect
        aria-label={t("roleOf", { name: member.user.name })}
        value={role}
        disabled={busy === member.id}
        className="w-36"
        onChange={(event) =>
          run(
            member.id,
            orgClient.organization.updateMemberRole({ memberId: member.id, role: event.target.value }),
            t("roleChanged"),
          )
        }
      >
        {ASSIGNABLE.map((value) => (
          <option key={value} value={value}>
            {t(`roles.${value}`)}
          </option>
        ))}
      </NativeSelect>
    )
  }

  const removeButton = (member: Member) => {
    if (!canManage || topRole(member.role) === "owner" || member.userId === meId) return null
    return (
      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoving(member)}>
        {t("remove")}
      </Button>
    )
  }

  const columns: DataColumn<Member>[] = [
    {
      id: "member",
      header: t("columns.member"),
      cell: (member) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">
            {member.user.name}
            {member.userId === meId ? <span className="ms-2 font-normal text-muted-foreground">{t("you")}</span> : null}
          </span>
          <span className="truncate text-muted-foreground text-sm" dir="ltr">
            {member.user.email}
          </span>
        </div>
      ),
    },
    { id: "role", header: t("columns.role"), cell: roleCell },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      align: "end",
      cell: removeButton,
    },
  ]

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-10">
        <Section title={t("members", { count: members.length })} description={t("membersHint")}>
          <DataTable
            caption={t("members", { count: members.length })}
            columns={columns}
            rows={members}
            getRowKey={(member) => member.id}
            card={(member) => (
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  {columns[0]?.cell(member)}
                  {removeButton(member)}
                </div>
                {roleCell(member)}
              </div>
            )}
          />
        </Section>

        {pending.length > 0 ? (
          <Section title={t("pending", { count: pending.length })} description={t("pendingHint")}>
            <ul className="flex flex-col divide-y rounded-lg border bg-card">
              {pending.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-medium" dir="ltr">
                      {invitation.email}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
                      <Badge variant="outline">{t(`roles.${topRole(invitation.role ?? "staff") as "staff"}`)}</Badge>
                      {t("expires")} <LocalDate value={new Date(invitation.expiresAt)} />
                    </span>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        loading={busy === `resend-${invitation.id}`}
                        onClick={() =>
                          run(
                            `resend-${invitation.id}`,
                            orgClient.organization.inviteMember({
                              email: invitation.email,
                              role: topRole(invitation.role ?? "staff") as Assignable,
                              resend: true,
                            }),
                            t("resent", { email: invitation.email }),
                          )
                        }
                      >
                        <RotateCwIcon data-icon="inline-start" />
                        {t("resend")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === `cancel-${invitation.id}`}
                        onClick={() =>
                          run(
                            `cancel-${invitation.id}`,
                            orgClient.organization.cancelInvitation({ invitationId: invitation.id }),
                            t("cancelled"),
                          )
                        }
                      >
                        <XIcon data-icon="inline-start" />
                        {t("cancel")}
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {members.length <= 1 && pending.length === 0 ? (
          <EmptyState icon={<UsersIcon />} title={t("emptyTitle")} description={t("emptyHint")} />
        ) : null}
      </div>

      <aside className="flex flex-col gap-8 lg:sticky lg:top-20">
        {canManage ? (
          <Section title={t("inviteTitle")} description={t("inviteHint")}>
            <InviteForm onSent={() => void refetch()} />
          </Section>
        ) : (
          <InlineAlert tone="info">{t("viewOnly")}</InlineAlert>
        )}
        <Section title={t("rolesTitle")}>
          <RoleHelp />
        </Section>
      </aside>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("removeTitle", { name: removing?.user.name ?? "" })}
        description={t("removeBody")}
        confirmLabel={t("remove")}
        cancelLabel={t("cancelAction")}
        destructive
        pending={busy === removing?.id}
        onConfirm={async () => {
          if (!removing) return
          await run(removing.id, orgClient.organization.removeMember({ memberIdOrEmail: removing.id }), t("removed"))
          setRemoving(null)
        }}
      />
    </div>
  )
}
