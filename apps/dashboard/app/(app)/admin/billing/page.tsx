import { FormSection } from "@ritorno/ui/components/form-section"
import { Section } from "@ritorno/ui/components/section"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PlanForm } from "@/components/admin-billing-forms"
import { InvoiceExport, InvoiceList } from "@/components/admin-invoices"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Billing" }

export default async function AdminBillingPage() {
  const [t, tHotel, plans, invoices] = await Promise.all([
    getTranslations("adminBilling"),
    getTranslations("adminHotel"),
    call((api) => api.admin.billing.plans()),
    call((api) => api.admin.billing.invoices({})),
  ])

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="flex flex-col gap-10 p-4 md:p-6">
        <Section title={t("invoices")}>
          <InvoiceExport disabled={!invoices.length} />
          <InvoiceList invoices={invoices} showHotel />
        </Section>
        <Section title={t("plans")}>
          <div className="flex flex-col">
            {plans.map((plan) => (
              <FormSection key={plan.plan} title={plan.name ?? tHotel(`plans.${plan.plan}`)}>
                <PlanForm plan={plan} />
              </FormSection>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
