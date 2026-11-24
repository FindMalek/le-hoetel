"use client"

import { cn } from "cn"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, "aria-label": label, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
