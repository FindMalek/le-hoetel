"use client"

import { Button } from "@ritorno/ui/components/button"
import { FormField } from "@ritorno/ui/components/form-field"
import { Input } from "@ritorno/ui/components/input"
import { Select, type SelectOption } from "@ritorno/ui/components/select"
import type { Route } from "next"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { AUDIT_ALL } from "@/lib/audit"

interface AuditFiltersProps {
  actions: SelectOption[]
  actors: SelectOption[]
  /** Admin only: a hotel's own log has nothing to pick. */
  hotels?: SelectOption[]
  values: { action?: string; actor?: string; hotel?: string; from?: string; to?: string }
  filtered: boolean
  resetHref: Route
}

/** A plain GET form, so the filters live in the url and work without script. */
export function AuditFilters({ actions, actors, hotels, values, filtered, resetHref }: AuditFiltersProps) {
  const t = useTranslations("adminAudit.filters")
  const all = (options: SelectOption[]) => [{ value: AUDIT_ALL, label: t("any") }, ...options]
  return (
    <form method="get" className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
      <FormField label={t("action")} className={hotels ? "lg:col-span-2" : "lg:col-span-3"}>
        {(aria) => <Select {...aria} name="action" defaultValue={values.action ?? AUDIT_ALL} options={all(actions)} />}
      </FormField>
      <FormField label={t("actor")} className={hotels ? "lg:col-span-2" : "lg:col-span-3"}>
        {(aria) => <Select {...aria} name="actor" defaultValue={values.actor ?? AUDIT_ALL} options={all(actors)} />}
      </FormField>
      {hotels ? (
        <FormField label={t("hotel")} className="sm:col-span-2 lg:col-span-2">
          {(aria) => <Select {...aria} name="hotel" defaultValue={values.hotel ?? AUDIT_ALL} options={all(hotels)} />}
        </FormField>
      ) : null}
      <FormField label={t("from")} className="lg:col-span-2">
        {(aria) => <Input {...aria} name="from" type="date" dir="ltr" defaultValue={values.from ?? ""} />}
      </FormField>
      <FormField label={t("to")} className="lg:col-span-2">
        {(aria) => <Input {...aria} name="to" type="date" dir="ltr" defaultValue={values.to ?? ""} />}
      </FormField>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-2">
        <Button type="submit" className="flex-1">
          {t("apply")}
        </Button>
        {filtered ? (
          <Button variant="outline" render={<Link href={resetHref} />} nativeButton={false}>
            {t("reset")}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
