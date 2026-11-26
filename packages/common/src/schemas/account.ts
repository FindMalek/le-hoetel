import { z } from "zod"
import { PROFILE_NAME_MAX } from "../constants"

/** The check better-auth runs on sign-in, sign-up, reset and invite. */
export const emailSchema = z.email()

export const meSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
  role: z.string().nullable(),
})

export const profileInputSchema = z.object({ name: z.string().trim().min(1).max(PROFILE_NAME_MAX) })

export const adminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  banned: z.boolean(),
  createdAt: z.date(),
  hotels: z.array(z.object({ id: z.string(), name: z.string(), role: z.string() })),
})

export const okSchema = z.object({ ok: z.literal(true) })

export type Me = z.infer<typeof meSchema>
