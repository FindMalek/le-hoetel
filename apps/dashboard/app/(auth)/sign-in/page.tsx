import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AuthForm } from "@/components/auth-form"
import { safeNext } from "@/lib/safe-next"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("signIn.title") }
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { next, reset, error } = await searchParams
  return (
    <AuthForm
      mode="sign-in"
      next={safeNext(next)}
      reset={reset === "1"}
      error={typeof error === "string" ? error : undefined}
    />
  )
}
