import { render } from "@react-email/render"
import { COPY } from "./copy"
import { type Builder, EMAILS } from "./emails"
import { createCtx, Layout } from "./layout"
import type { HotelEmailKey, RenderEmailInput } from "./types"

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/** A hotel email as html and a plain text twin, in the hotel's colors and the guest's language. */
export async function renderEmail<Key extends HotelEmailKey>(
  key: Key,
  { hotel, guest, locale, props }: RenderEmailInput<Key>,
): Promise<RenderedEmail> {
  const ctx = createCtx(hotel, guest, locale, COPY[locale])
  const { subject, preview, body } = (EMAILS[key] as Builder<Key>)(ctx, props)
  const element = (
    <Layout ctx={ctx} preview={preview}>
      {body}
    </Layout>
  )
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
  return { subject, html, text }
}
