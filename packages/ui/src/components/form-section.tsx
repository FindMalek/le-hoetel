import { cn } from "@ritorno/ui/lib/utils"

type FormSectionProps = Omit<React.ComponentProps<"section">, "title"> & {
  title: React.ReactNode
  description?: React.ReactNode
}

function FormSection({ title, description, className, children, ...props }: FormSectionProps) {
  return (
    <section
      className={cn("grid grid-cols-1 gap-4 border-b py-6 first:pt-0 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-10", className)}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-heading font-semibold text-base">{title}</h2>
        {description ? <p className="text-pretty text-muted-foreground text-sm">{description}</p> : null}
      </div>
      <div className="flex max-w-xl flex-col gap-4">{children}</div>
    </section>
  )
}

export { FormSection }
