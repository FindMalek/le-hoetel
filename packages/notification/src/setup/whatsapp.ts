import { TemplateDefinition, WhatsAppClient } from "@kapso/whatsapp-cloud-api"
import { LOCALES, type Locale } from "@le-hoetel/i18n/config"
import { KAPSO_BASE_URL, NOTIFY_PARAM, NOTIFY_TEMPLATE_BODY } from "../channels/whatsapp"
import { HOTEL_EMAIL_KEYS, type HotelEmailKey } from "../hotel-email"
import { GUEST_WHATSAPP_TEMPLATES, guestTemplateFooter } from "../whatsapp-guest"

const { KAPSO_API_KEY, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_TEMPLATE_NAME, WHATSAPP_TEMPLATE_LANGUAGE } = process.env

if (!KAPSO_API_KEY || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
  console.error(`Set these in .env first:
  KAPSO_API_KEY               https://app.kapso.ai (project settings, API keys)
  WHATSAPP_BUSINESS_ACCOUNT_ID  the WhatsApp business account id of your connected number`)
  process.exit(1)
}

const client = new WhatsAppClient({ baseUrl: KAPSO_BASE_URL, kapsoApiKey: KAPSO_API_KEY })
const guestComponents = (key: HotelEmailKey, language: Locale) => {
  const { params, examples, body } = GUEST_WHATSAPP_TEMPLATES[key]
  return TemplateDefinition.buildTemplateDefinition({
    name: GUEST_WHATSAPP_TEMPLATES[key].name,
    language,
    category: "MARKETING",
    parameterFormat: "NAMED",
    components: [
      {
        type: "BODY",
        text: body[language],
        example: { bodyTextNamedParams: params.map((paramName) => ({ paramName, example: examples[paramName]! })) },
      },
      { type: "FOOTER", text: guestTemplateFooter(language) },
    ],
  })
}

const submitted: string[] = []
for (const key of HOTEL_EMAIL_KEYS) {
  for (const language of LOCALES) {
    const definition = guestComponents(key, language)
    try {
      await client.templates.create({ businessAccountId: WHATSAPP_BUSINESS_ACCOUNT_ID, ...definition })
      submitted.push(`${definition.name} (${language})`)
    } catch (error) {
      console.error(
        `Could not create "${definition.name}" (${language}): ${error instanceof Error ? error.message : error}`,
      )
    }
  }
}
console.info(`Submitted ${submitted.length} guest templates: ${submitted.join(", ")}.`)
console.info("Meta reviews each one, which can take a few minutes. Guest messages send only once they are approved.")

const name = WHATSAPP_TEMPLATE_NAME || "app_notification"
const language = WHATSAPP_TEMPLATE_LANGUAGE || "en_US"

const definition = TemplateDefinition.buildTemplateDefinition({
  name,
  language,
  category: "UTILITY",
  parameterFormat: "NAMED",
  components: [
    {
      type: "BODY",
      text: NOTIFY_TEMPLATE_BODY,
      example: { bodyTextNamedParams: [{ paramName: NOTIFY_PARAM, example: "New signup" }] },
    },
  ],
})

try {
  await client.templates.create({ businessAccountId: WHATSAPP_BUSINESS_ACCOUNT_ID, ...definition })
  console.info(`Submitted the team alert template "${name}" (${language}).`)
} catch (error) {
  console.error(`Could not create "${name}": ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
