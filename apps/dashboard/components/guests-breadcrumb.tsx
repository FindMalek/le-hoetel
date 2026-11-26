import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ritorno/ui/components/breadcrumb"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

/** Guests, then `current`. With `href` and `page`, `current` becomes a link and `page` the last crumb. */
export async function GuestsBreadcrumb({ current, href, page }: { current: string; href?: string; page?: string }) {
  const t = await getTranslations("guests")
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/guests" />}>{t("title")}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {href && page ? (
            <BreadcrumbLink render={<Link href={href as never} />}>{current}</BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{current}</BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {href && page ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{page}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
