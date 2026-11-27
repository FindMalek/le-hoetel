import { BentoGrid, BentoTile } from "@ritorno/ui/brand/bento"
import { BrowserFrame, PhoneFrame } from "@ritorno/ui/brand/device-frame"
import { Display } from "@ritorno/ui/brand/display"
import { EmbossedWordmark } from "@ritorno/ui/brand/embossed-wordmark"
import { GradientBand } from "@ritorno/ui/brand/gradient-band"
import { PillNav } from "@ritorno/ui/brand/pill-nav"
import { PixelSky } from "@ritorno/ui/brand/pixel-sky"
import { Button } from "@ritorno/ui/components/button"
import { Chip } from "@ritorno/ui/components/chip"
import { cn } from "@ritorno/ui/lib/utils"
import { BellIcon, CheckIcon, MailIcon, MessageCircleIcon, QrCodeIcon, StarIcon } from "lucide-react"
import type { ReactNode } from "react"

const GUESTS = [
  { name: "Amira Ben Salah", stay: "3 nights, room 12", returning: true, whatsapp: true, email: true },
  { name: "Lucas Moreau", stay: "1 night, room 4", returning: false, whatsapp: false, email: true },
  { name: "Sofia Rossi", stay: "5 nights, room 21", returning: true, whatsapp: true, email: false },
  { name: "Youssef Trabelsi", stay: "2 nights, room 8", returning: false, whatsapp: true, email: true },
]

export function Preview({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("not-prose my-6 overflow-hidden rounded-card border bg-background", className)}>{children}</div>
  )
}

export function HeroExample() {
  return (
    <Preview className="relative">
      <div className="relative isolate flex min-h-160 flex-col items-center justify-center px-4 pt-20 pb-12 text-center md:pt-32">
        <PixelSky clearCenter className="-z-10" />
        <PillNav
          as="div"
          className="absolute"
          homeHref="#top"
          navLabel="Main"
          menuLabel="Menu"
          links={[
            { href: "#product", label: "Product" },
            { href: "#how", label: "How it works" },
            { href: "#pricing", label: "Pricing" },
            { href: "#faq", label: "FAQ" },
          ]}
          cta={{ href: "#demo", label: "Request a demo" }}
          signIn={{ href: "#sign-in", label: "Sign in" }}
        />
        <div data-sky-clear className="flex flex-col items-center">
          <Display as="h2" size="xl" reveal className="max-w-3xl">
            Every guest, <em>welcomed</em> back by name
          </Display>
          <p className="mt-5 max-w-md text-lead text-muted-foreground">
            Consent first guest profiles, post-stay surveys and return offers for independent hotels.
          </p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-2 sm:w-auto sm:max-w-none sm:flex-row">
            <Button size="lg">Request a demo</Button>
            <Button size="lg" variant="secondary">
              See how it works
            </Button>
          </div>
        </div>
      </div>
    </Preview>
  )
}

export function SkyExample() {
  return (
    <Preview>
      <div className="relative h-56">
        <PixelSky />
      </div>
    </Preview>
  )
}

export function DisplayExample() {
  return (
    <Preview className="grid gap-8 p-6 md:p-10">
      <Display as="p">
        Guests come <em>back</em>
      </Display>
      <Display as="p" lang="ar" dir="rtl">
        ضيوفكم <em>يعودون</em> إليكم
      </Display>
    </Preview>
  )
}

export function ChipExample() {
  return (
    <Preview className="flex flex-wrap gap-2 p-6">
      <Chip>
        <QrCodeIcon />
        QR scan
      </Chip>
      <Chip tone="info">
        <StarIcon />
        Returning
      </Chip>
      <Chip tone="success">
        <CheckIcon />
        Consent logged
      </Chip>
      <Chip tone="warning">
        <BellIcon />
        Low score
      </Chip>
      <Chip tone="danger">Unsubscribed</Chip>
    </Preview>
  )
}

function GuestList() {
  return (
    <div className="flex flex-col bg-background text-start">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="text-small font-semibold">Guests</span>
        <span className="h-8 w-40 rounded-full bg-surface px-3 text-caption leading-8 text-muted-foreground">
          Search guests
        </span>
      </div>
      {GUESTS.map((guest) => (
        <div key={guest.name} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-blue-50 text-caption font-semibold text-blue-700">
            {guest.name
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-small font-medium">
              <span className="truncate">{guest.name}</span>
              {guest.returning ? (
                <Chip tone="info" className="h-5 px-2">
                  Returning
                </Chip>
              ) : null}
            </div>
            <div className="text-caption text-muted-foreground">{guest.stay}</div>
          </div>
          <div className="hidden gap-1 sm:flex">
            {guest.whatsapp ? (
              <Chip tone="success" className="h-6 px-2">
                <MessageCircleIcon />
                WhatsApp
              </Chip>
            ) : null}
            {guest.email ? (
              <Chip className="h-6 px-2">
                <MailIcon />
                Email
              </Chip>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function CapturePage() {
  return (
    <div className="flex size-full flex-col gap-3 bg-surface px-4 pt-12 pb-4 text-start">
      <div className="font-serif text-2xl italic">Dar Zitouna</div>
      <p className="text-caption text-muted-foreground">Leave your details and we will welcome you back.</p>
      {["Name", "Phone", "Language"].map((field) => (
        <div
          key={field}
          className="h-10 rounded-input border bg-background px-3 text-caption leading-10 text-muted-foreground"
        >
          {field}
        </div>
      ))}
      <div className="flex items-center gap-2 text-caption">
        <span className="grid size-4 place-items-center rounded bg-foreground text-background">
          <CheckIcon className="size-3" />
        </span>
        WhatsApp offers
      </div>
      <div className="mt-auto h-10 rounded-full bg-foreground text-center text-caption leading-10 font-medium text-background">
        Join
      </div>
    </div>
  )
}

export function FramesExample() {
  return (
    <Preview className="bg-canvas px-4 py-10 md:px-10 md:py-14">
      <div className="relative mx-auto max-w-3xl">
        <BrowserFrame
          label="Guest list with returning guests and consent per channel"
          url="app.ritorno.co/guests"
          className="hidden sm:block"
        >
          <GuestList />
        </BrowserFrame>
        <PhoneFrame
          label="Guest capture page for Dar Zitouna"
          className="mx-auto w-56 sm:absolute sm:-end-6 sm:-bottom-10 sm:mx-0 sm:w-44 md:w-48"
        >
          <CapturePage />
        </PhoneFrame>
      </div>
    </Preview>
  )
}

export function BentoExample() {
  return (
    <Preview className="border-0">
      <BentoGrid>
        <BentoTile
          span={4}
          href="#recognition"
          chips={
            <Chip>
              <StarIcon />
              Front desk
            </Chip>
          }
          title="Know who is back"
          description="Returning guests are flagged the moment they check in."
          media={
            <div className="w-full border-t">
              <GuestList />
            </div>
          }
        />
        <BentoTile
          span={2}
          chips={
            <Chip tone="warning">
              <BellIcon />
              Alert
            </Chip>
          }
          title="Hear it first"
          description="A low survey score pings the manager."
          media={
            <div className="relative min-h-40 w-full self-stretch overflow-hidden">
              <PixelSky cellSize={6} fadeTop />
            </div>
          }
        />
        <BentoTile
          span={3}
          chips={<Chip tone="success">Consent</Chip>}
          title="Asked, logged, kept"
          description="Per channel, with time and wording."
        />
        <BentoTile
          span={3}
          chips={<Chip tone="info">Campaigns</Chip>}
          title="Offers that bring them back"
          description="WhatsApp and email, every one with STOP."
        />
      </BentoGrid>
    </Preview>
  )
}

export function FooterExample() {
  return (
    <Preview className="bg-canvas">
      <div className="px-4 pt-16">
        <EmbossedWordmark className="[&_svg]:w-full" />
      </div>
      <GradientBand />
    </Preview>
  )
}
