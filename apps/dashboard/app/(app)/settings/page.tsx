import { FormSection } from "@le-hoetel/ui/components/form-section"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import { PasswordForm } from "@/components/password-form"
import { PreferencesSection } from "@/components/preferences-section"
import { PrivacyPanel } from "@/components/privacy-panel"
import { ProfileForm } from "@/components/profile-form"
import { SessionsList } from "@/components/sessions-list"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Settings" }

export default async function SettingsPage() {
  const t = await getTranslations("settings")
  const me = await call((api) => api.me.get())
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        <FormSection title={t("sections.profile.title")} description={t("sections.profile.description")}>
          <ProfileForm me={me} />
        </FormSection>
        <FormSection title={t("sections.preferences.title")} description={t("sections.preferences.description")}>
          <PreferencesSection />
        </FormSection>
        <FormSection title={t("sections.password.title")} description={t("sections.password.description")}>
          <PasswordForm />
        </FormSection>
        <FormSection title={t("sections.sessions.title")} description={t("sections.sessions.description")}>
          <SessionsList />
        </FormSection>
        <FormSection title={t("sections.data.title")} description={t("sections.data.description")}>
          <PrivacyPanel email={me.email} />
        </FormSection>
      </div>
    </>
  )
}
