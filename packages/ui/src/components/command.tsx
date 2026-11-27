"use client"

import { Command as CommandPrimitive, defaultFilter } from "cmdk"
import { cn } from "@ritorno/ui/lib/utils"
import { SearchIcon } from "lucide-react"
import type * as React from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@ritorno/ui/components/dialog"

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn("flex size-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground", className)}
      {...props}
    />
  )
}

/** Prefix for the `value` of items the server already matched, so the palette does not filter them a second time. */
const SERVER_MATCH = "server-match:"

const dialogFilter = (value: string, search: string, keywords?: string[]) =>
  value.startsWith(SERVER_MATCH) ? 1 : defaultFilter(value, search, keywords)

function CommandDialog({
  title = "Command palette",
  description = "Search for a command to run",
  children,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent className="top-1/3 translate-y-0 overflow-hidden p-0 max-sm:top-4 sm:max-w-lg" showCloseButton={false}>
        <Command
          filter={dialogFilter}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-sm">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-10 coarse:h-12 items-center gap-2 border-b px-3">
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-10 coarse:h-12 w-full bg-transparent text-sm coarse:text-base outline-none placeholder:text-muted-foreground disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("max-h-80 max-sm:max-h-[50dvh] scroll-py-1 overflow-y-auto overflow-x-hidden", className)}
      {...props}
    />
  )
}

function CommandEmpty(props: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className="py-6 text-center text-sm" {...props} />
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return <CommandPrimitive.Group data-slot="command-group" className={cn("overflow-hidden p-1", className)} {...props} />
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex coarse:min-h-11 cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-muted data-[selected=true]:text-foreground data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  )
}

export { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, SERVER_MATCH }
