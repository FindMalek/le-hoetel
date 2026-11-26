import type { ReactNode } from "react"
import { Cta, type Ctx, OfferCard, Paragraph, Title } from "./layout"
import type { EmailProps, HotelEmailKey } from "./types"

export interface Built {
  subject: string
  preview: string
  body: ReactNode
}

type Builder<Key extends HotelEmailKey> = (ctx: Ctx, props: EmailProps[Key]) => Built

const greeting = (ctx: Ctx) => <Paragraph ctx={ctx}>{ctx.t(ctx.copy.common.greeting)}</Paragraph>

const welcome: Builder<"welcome"> = (ctx, { offer, ctaUrl }) => {
  const { welcome: c } = ctx.copy
  return {
    subject: ctx.t(c.subject),
    preview: ctx.t(c.preview),
    body: (
      <>
        <Title ctx={ctx}>{ctx.t(c.title)}</Title>
        {greeting(ctx)}
        <Paragraph ctx={ctx}>{ctx.t(c.body)}</Paragraph>
        {offer ? (
          <>
            <Paragraph ctx={ctx}>{c.offerIntro}</Paragraph>
            <OfferCard ctx={ctx} offer={offer} />
          </>
        ) : null}
        {ctaUrl ? (
          <Cta ctx={ctx} href={ctaUrl}>
            {ctx.t(offer ? c.offerCta : c.cta)}
          </Cta>
        ) : null}
      </>
    ),
  }
}

const birthday: Builder<"birthday"> = (ctx, { offer, ctaUrl }) => {
  const { birthday: c } = ctx.copy
  return {
    subject: ctx.t(c.subject),
    preview: ctx.t(c.preview),
    body: (
      <>
        <Title ctx={ctx}>{ctx.t(c.title)}</Title>
        <Paragraph ctx={ctx}>{ctx.t(c.body)}</Paragraph>
        <OfferCard ctx={ctx} offer={offer} />
        {ctaUrl ? (
          <Cta ctx={ctx} href={ctaUrl}>
            {c.cta}
          </Cta>
        ) : null}
      </>
    ),
  }
}

const survey: Builder<"survey"> = (ctx, { ctaUrl }) => {
  const { survey: c } = ctx.copy
  return {
    subject: ctx.t(c.subject),
    preview: ctx.t(c.preview),
    body: (
      <>
        <Title ctx={ctx}>{ctx.t(c.title)}</Title>
        {greeting(ctx)}
        <Paragraph ctx={ctx}>{ctx.t(c.body)}</Paragraph>
        <Cta ctx={ctx} href={ctaUrl}>
          {c.cta}
        </Cta>
      </>
    ),
  }
}

const reminder: Builder<"reminder"> = (ctx, { offer, ctaUrl }) => {
  const { reminder: c } = ctx.copy
  return {
    subject: ctx.t(c.subject),
    preview: ctx.t(c.preview),
    body: (
      <>
        <Title ctx={ctx}>{ctx.t(c.title)}</Title>
        {greeting(ctx)}
        <Paragraph ctx={ctx}>{ctx.t(c.body)}</Paragraph>
        <OfferCard ctx={ctx} offer={offer} />
        {ctaUrl ? (
          <Cta ctx={ctx} href={ctaUrl}>
            {c.cta}
          </Cta>
        ) : null}
      </>
    ),
  }
}

const message: Builder<"message"> = (ctx, { subject, title, body, offer, ctaUrl, ctaLabel }) => ({
  subject: ctx.t(subject),
  preview: ctx.t(title),
  body: (
    <>
      <Title ctx={ctx}>{ctx.own(ctx.t(title))}</Title>
      {ctx
        .t(body)
        .split(/\n{2,}/)
        .map((text) => (
          <Paragraph key={text} ctx={ctx}>
            {ctx.own(text)}
          </Paragraph>
        ))}
      {offer ? <OfferCard ctx={ctx} offer={offer} /> : null}
      {ctaUrl ? (
        <Cta ctx={ctx} href={ctaUrl}>
          {ctaLabel ? ctx.own(ctaLabel) : ctx.copy.message.cta}
        </Cta>
      ) : null}
    </>
  ),
})

export const EMAILS: { [Key in HotelEmailKey]: Builder<Key> } = { welcome, birthday, survey, reminder, message }
export type { Builder }
