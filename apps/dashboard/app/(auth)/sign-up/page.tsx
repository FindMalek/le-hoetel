import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AuthForm } from "@/components/auth-form"
import { safeNext } from "@/lib/safe-next"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("signUp.title") }
}

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { next } = await searchParams
  return <AuthForm mode="sign-up" next={safeNext(next)} />
}
