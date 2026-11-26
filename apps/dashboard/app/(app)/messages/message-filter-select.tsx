"use client"

import { FormField } from "@ritorno/ui/components/form-field"
import { Select, type SelectOption } from "@ritorno/ui/components/select"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

const ANY = "any"

/** A filter that lives in the url: picking an option replaces the param and goes back to the first page. */
export function MessageFilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string
  label: string
  value: string | undefined
  options: readonly SelectOption<string>[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const choose = (next: string) => {
    const query = new URLSearchParams(params)
    if (next === ANY) query.delete(name)
    else query.set(name, next)
    query.delete("page")
    const text = query.toString()
    startTransition(() => router.replace((text ? `${pathname}?${text}` : pathname) as never, { scroll: false }))
  }

  return (
    <FormField label={label} className="min-w-0 gap-1.5 md:w-48" id={`messages-${name}`}>
      {(aria) => <Select {...aria} value={value ?? ANY} onValueChange={choose} disabled={pending} options={options} />}
    </FormField>
  )
}
