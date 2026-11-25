"use client"

import { Button } from "@le-hoetel/ui/components/button"
import { Input } from "@le-hoetel/ui/components/input"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { type ComponentProps, useState } from "react"

export function PasswordInput(props: Omit<ComponentProps<typeof Input>, "type">) {
  const t = useTranslations("auth")
  const [shown, setShown] = useState(false)
  return (
    <div className="relative" dir="ltr">
      <Input {...props} type={shown ? "text" : "password"} className="pe-12" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="-translate-y-1/2 absolute end-1 top-1/2"
        aria-label={shown ? t("hidePassword") : t("showPassword")}
        aria-pressed={shown}
        onClick={() => setShown((value) => !value)}
      >
        {shown ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
    </div>
  )
}
