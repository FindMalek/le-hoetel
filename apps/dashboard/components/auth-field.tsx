"use client"

import { FormField } from "@ritorno/ui/components/form-field"
import { Input } from "@ritorno/ui/components/input"
import type { ComponentProps } from "react"
import { PasswordInput } from "@/components/password-input"

type AuthFieldProps = Omit<ComponentProps<typeof Input>, "id" | "name"> & {
  name: string
  label: string
  hint?: string
  error?: string | null
}

export function AuthField({ name, label, hint, error, type = "text", ...props }: AuthFieldProps) {
  return (
    <FormField id={name} label={label} hint={hint} error={error}>
      {(control) =>
        type === "password" ? (
          <PasswordInput {...control} name={name} {...props} />
        ) : (
          <Input {...control} name={name} type={type} {...props} />
        )
      }
    </FormField>
  )
}
