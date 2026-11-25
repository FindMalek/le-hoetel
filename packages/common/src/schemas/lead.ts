import { z } from "zod"
import { HOTEL_LANGUAGES } from "../hotel"
import { phoneInputSchema } from "./guest"

/** A hotel owner or manager asking for a demo on the landing page. */
export const leadInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  hotel: z.string().trim().min(2).max(120),
  phone: phoneInputSchema,
  city: z.string().trim().min(2).max(80),
  language: z.enum(HOTEL_LANGUAGES),
  /** Hidden field no person fills: any value means a bot. */
  website: z.string().max(200).nullish(),
})
export type LeadInput = z.input<typeof leadInputSchema>
