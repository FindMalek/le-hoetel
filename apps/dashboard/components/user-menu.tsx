"use client"

import { authClient } from "@ritorno/auth/client"
import { Avatar, AvatarFallback, AvatarImage } from "@ritorno/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ritorno/ui/components/dropdown-menu"
import { SidebarMenuButton } from "@ritorno/ui/components/sidebar"
import { ChevronsUpDownIcon, CircleUserIcon, LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { PreferencesMenu } from "@/components/preferences-menu"

export interface Me {
  name: string
  email: string
  image: string | null
  role: string | null
}

export const signOut = async () => {
  await authClient.signOut()
  window.location.assign("/sign-in")
}

export function UserAvatar({ me, className }: { me: Me; className?: string }) {
  return (
    <Avatar className={className}>
      {me.image ? <AvatarImage src={me.image} alt="" /> : null}
      <AvatarFallback>{me.name.trim().slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

/** The sidebar footer: who you are, with your account, language and sign out. */
export function UserMenu({ me }: { me: Me }) {
  const t = useTranslations("shell")
  const tNav = useTranslations("nav")
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<SidebarMenuButton size="lg" className="hover:bg-sidebar-accent/70" aria-label={t("account")} />}
      >
        <UserAvatar me={me} className="size-8" />
        <span className="grid flex-1 text-start text-sm leading-tight">
          <span className="truncate font-medium">{me.name}</span>
          <span className="truncate text-muted-foreground text-xs" dir="ltr">
            {me.email}
          </span>
        </span>
        <ChevronsUpDownIcon className="ms-auto text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate" dir="ltr">
            {me.email}
          </DropdownMenuLabel>
          <DropdownMenuItem className="min-h-11" onClick={() => router.push("/settings")}>
            <CircleUserIcon />
            {tNav("account")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <PreferencesMenu />
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11" onClick={signOut}>
          <LogOutIcon />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
