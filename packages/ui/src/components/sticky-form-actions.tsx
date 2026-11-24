import { cn } from "cn"

function StickyFormActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "sticky bottom-nav z-20 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:static md:mx-0 md:flex-row md:justify-end md:border-t-0 md:bg-transparent md:px-0 md:backdrop-blur-none *:max-md:w-full",
        className,
      )}
      {...props}
    />
  )
}

export { StickyFormActions }
