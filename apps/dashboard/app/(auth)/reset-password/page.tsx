import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ResetPasswordForm } from "@/components/reset-password-form"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("reset.title") }
}

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token, error } = await searchParams
  const value = Array.isArray(token) ? token[0] : token
  return <ResetPasswordForm token={error || !value ? null : value} />
}
