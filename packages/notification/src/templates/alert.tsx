import type { Locale } from "@ritorno/i18n/config"
import { defineTemplate } from "./define"
import { Box, CtaButton, Label, Layout, Paragraph, Rows, Title } from "./primitives"

interface Data {
  title: string
  intro?: string
  items: { label: string; value: string }[]
  url?: string
  /** For alerts written in the reader's language, like the hotel manager's low score alert. */
  locale?: Locale
  eyebrow?: string
  cta?: string
}

export const alert = defineTemplate<Data>({
  subject: ({ title }) => title,
  summary: ({ title, intro, items, url, cta }) => ({
    title,
    lines: [...(intro ? [intro] : []), ...items.map((item) => `${item.label}: ${item.value}`)],
    link: url ? { label: cta ?? "Open", url } : undefined,
  }),
  preview: {
    title: "Daily digest",
    intro: "Here is what happened in the last 24 hours.",
    items: [
      { label: "New signups", value: "12" },
      { label: "Failed payments", value: "1" },
      { label: "Open issues", value: "4" },
    ],
    url: "https://app.example.com/admin",
  },
  Email: ({ title, intro, items, url, locale, eyebrow, cta, appUrl }) => (
    <Layout preview={intro ?? title} appUrl={appUrl} locale={locale}>
      <Box>
        <Label>{eyebrow ?? "Notification"}</Label>
        <Title>{title}</Title>
        {intro ? <Paragraph>{intro}</Paragraph> : null}
        {items.length > 0 ? <Rows rows={items} /> : null}
        {url ? <CtaButton href={url}>{cta ?? "Open"}</CtaButton> : null}
      </Box>
    </Layout>
  ),
})
