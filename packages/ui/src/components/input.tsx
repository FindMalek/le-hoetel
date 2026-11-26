"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

const LTR_TYPES = new Set(["email", "tel", "url"])

/** Emails, phones and urls read left to right in Arabic too, so they default to `dir="ltr"`. */
function Input({ className, type, dir, inputMode, ...props }: React.ComponentProps<"input">) {
  const ltr = LTR_TYPES.has(type ?? "") || LTR_TYPES.has(inputMode ?? "")
  return (
    <InputPrimitive
      type={type}
      inputMode={inputMode}
      dir={dir ?? (ltr ? "ltr" : undefined)}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
