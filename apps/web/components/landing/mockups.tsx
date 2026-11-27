import { LOCALE_NAMES } from "@ritorno/i18n"
import { Logo } from "@ritorno/ui/brand/logo"
import { Chip } from "@ritorno/ui/components/chip"
import { StatCard } from "@ritorno/ui/components/stat-card"
import { cn } from "@ritorno/ui/lib/utils"
import {
  BarChart3Icon,
  GiftIcon,
  HomeIcon,
  MailIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react"
import { getTranslations } from "next-intl/server"

type Language = "en" | "fr" | "ar"

/** Made-up guests of the sample hotel, the same in every locale. */
export const SAMPLE_GUESTS: {
  name: string
  room: string
  language: Language
  stays: number
  whatsapp: boolean
  email: boolean
}[] = [
  { name: "Amira Ben Salah", room: "12", language: "fr", stays: 3, whatsapp: true, email: true },
  { name: "Youssef Trabelsi", room: "8", language: "ar", stays: 1, whatsapp: true, email: false },
  { name: "Lucas Moreau", room: "21", language: "fr", stays: 1, whatsapp: false, email: true },
  { name: "Ines Gharbi", room: "4", language: "ar", stays: 2, whatsapp: true, email: true },
  { name: "Sarah Klein", room: "30", language: "en", stays: 4, whatsapp: false, email: true },
  { name: "Mehdi Jaziri", room: "15", language: "fr", stays: 1, whatsapp: true, email: false },
]

export const SAMPLE_HOTEL = "Dar Zitouna"

/** The sample hotel's own color on guest facing mockups, like the real guest pages get from branding. */
export const HOTEL_COLORS = "[--primary:var(--chart-3)] [--primary-foreground:var(--background)]"

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 font-semibold text-blue-700 text-caption",
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export async function ConsentChips({ whatsapp, email }: { whatsapp: boolean; email: boolean }) {
  const t = await getTranslations("guests.consent")
  return (
    <span className="flex gap-1">
      {whatsapp ? (
        <Chip tone="success" className="h-6 px-2">
          <MessageCircleIcon />
          {t("whatsapp")}
        </Chip>
      ) : null}
      {email ? (
        <Chip className="h-6 px-2">
          <MailIcon />
          {t("email")}
        </Chip>
      ) : null}
    </span>
  )
}

/** The hotel home of the dashboard: sidebar, greeting, three stat cards and the latest guests. */
export async function DashboardMockup() {
  const [t, nav, home] = await Promise.all([
    getTranslations("landing.shot"),
    getTranslations("nav"),
    getTranslations("home"),
  ])
  const links = [
    { icon: HomeIcon, label: nav("home"), active: true },
    { icon: UsersIcon, label: nav("guests") },
    { icon: MegaphoneIcon, label: nav("campaigns") },
    { icon: GiftIcon, label: nav("offers") },
    { icon: BarChart3Icon, label: nav("metrics") },
  ]
  return (
    <div className="flex aspect-[16/10] bg-background text-start">
      <div className="hidden w-52 shrink-0 flex-col gap-0.5 border-e bg-surface p-3 lg:flex">
        <div className="mb-3 flex items-center gap-2 px-2 py-1.5">
          <Logo variant="mark" size={24} label="" />
          <span className="font-semibold text-small">{SAMPLE_HOTEL}</span>
        </div>
        {links.map(({ icon: Icon, label, active }) => (
          <span
            key={label}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-muted-foreground text-small",
              active && "bg-background font-medium text-foreground shadow-xs",
            )}
          >
            <Icon className="size-4" />
            {label}
          </span>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5 lg:gap-5 lg:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <span className="font-semibold text-h2">{home("greeting", { name: "Amel" })}</span>
            <span className="text-muted-foreground text-small">
              {home("hotelDescription", { hotel: SAMPLE_HOTEL })}
            </span>
          </div>
          <span className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 font-medium text-background text-small md:flex">
            <PlusIcon className="size-4" />
            {t("addGuest")}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            className="p-4 md:p-4"
            label={home("guests")}
            value="1,284"
            delta={{ direction: "up", value: "+18%" }}
          />
          <StatCard
            className="p-4 md:p-4"
            label={t("returning")}
            value="212"
            delta={{ direction: "up", value: "+9%" }}
          />
          <StatCard className="p-4 md:p-4" label={t("score")} value="4.6" delta={{ direction: "up", value: "+0.2" }} />
        </div>
        <GuestTable />
      </div>
    </div>
  )
}

async function GuestTable() {
  const [t, home] = await Promise.all([getTranslations("landing.shot"), getTranslations("home")])
  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-card border">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="font-medium text-small">{home("latest")}</span>
        <span className="flex h-8 w-44 items-center gap-2 rounded-full bg-surface px-3 text-caption text-muted-foreground">
          <SearchIcon className="size-3.5" />
          {t("search")}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto] border-y bg-surface px-4 py-2 text-caption text-muted-foreground md:grid-cols-[1.6fr_1fr_1fr]">
        <span>{home("name")}</span>
        <span className="hidden md:block">{home("language")}</span>
        <span>{t("consent")}</span>
      </div>
      {SAMPLE_GUESTS.map((guest) => (
        <div
          key={guest.name}
          className="grid grid-cols-[1fr_auto] items-center border-b px-4 py-2.5 last:border-b-0 md:grid-cols-[1.6fr_1fr_1fr]"
        >
          <span className="flex min-w-0 items-center gap-3">
            <Avatar name={guest.name} />
            <span className="grid min-w-0">
              <span className="flex items-center gap-2 font-medium text-small">
                <span className="truncate">{guest.name}</span>
                {guest.stays > 1 ? (
                  <Chip tone="info" className="hidden h-5 px-2 lg:inline-flex">
                    <StarIcon />
                    {t("returning")}
                  </Chip>
                ) : null}
              </span>
              <span className="text-caption text-muted-foreground">{t("room", { room: guest.room })}</span>
            </span>
          </span>
          <span className="hidden text-muted-foreground text-small md:block">{LOCALE_NAMES[guest.language]}</span>
          <ConsentChips whatsapp={guest.whatsapp} email={guest.email} />
        </div>
      ))}
    </div>
  )
}

/** The page a guest opens from the room QR code, in the hotel's own color. */
export async function CaptureMockup() {
  const [t, capture] = await Promise.all([getTranslations("landing.shot"), getTranslations("capture")])
  return (
    <div className={cn(HOTEL_COLORS, "flex size-full flex-col bg-background text-start")}>
      <div className="border-b bg-linear-to-b from-primary/20 to-primary/5 px-4 pt-10 pb-4 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary font-semibold text-primary-foreground text-small">
          {initials(SAMPLE_HOTEL)}
        </span>
        <div className="mt-2 font-semibold text-small">{SAMPLE_HOTEL}</div>
        <p className="mx-auto mt-1 max-w-[24ch] text-balance text-caption text-muted-foreground">
          {capture("welcome")}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <Field label={capture("name")} value="Amira Ben Salah" />
        <Field label={capture("phone")} value="+216 98 765 432" ltr />
        <span className="mt-1 font-medium text-caption">{capture("consentTitle")}</span>
        <Toggle label={capture("whatsappTitle")} on />
        <Toggle label={capture("emailTitle")} />
        <span className="mt-auto grid h-10 place-items-center rounded-full bg-primary font-medium text-primary-foreground text-small">
          {capture("submit")}
        </span>
        <span className="text-center text-[0.625rem] text-muted-foreground leading-tight">{t("stop")}</span>
      </div>
    </div>
  )
}

function Field({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <span className="grid gap-1">
      <span className="font-medium text-caption">{label}</span>
      <span className="flex h-9 items-center rounded-input border px-3 text-caption">
        {ltr ? <bdi dir="ltr">{value}</bdi> : value}
      </span>
    </span>
  )
}

export function Toggle({ label, on = false }: { label: string; on?: boolean }) {
  return (
    <span className="flex h-9 items-center justify-between gap-2 rounded-input border px-3 text-caption">
      {label}
      <span
        className={cn(
          "flex h-4 w-7 items-center rounded-full p-0.5",
          on ? "justify-end bg-primary" : "justify-start bg-foreground/15",
        )}
      >
        <span className="size-3 rounded-full bg-background shadow-xs" />
      </span>
    </span>
  )
}
