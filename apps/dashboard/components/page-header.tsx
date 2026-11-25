import { PageHeader as Header } from "@le-hoetel/ui/components/page-header"

/** The title block every page starts with. Pages put their content in their own padded wrapper below it. */
export function PageHeader(props: { title: string; description?: string; actions?: React.ReactNode }) {
  return <Header className="px-4 pt-6 md:px-6 md:pt-8" {...props} />
}
