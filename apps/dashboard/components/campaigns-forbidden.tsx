import { PageState } from "@ritorno/ui/components/page-state"
import { MegaphoneIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"

/** Every campaign page, for a role the api refuses. */
export async function CampaignsForbidden() {
  const t = await getTranslations("campaigns")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        <PageState
          kind="forbidden"
          icon={<MegaphoneIcon />}
          title={t("forbiddenTitle")}
          description={t("forbiddenBody")}
        />
      </div>
    </>
  )
}
