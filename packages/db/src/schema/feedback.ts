import { FEEDBACK_CASE_STATUSES } from "@le-hoetel/common/survey"
import { index, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core"
import { user } from "./auth"
import { organization } from "./orgs"
import { surveyResponses } from "./surveys"

export const feedbackCaseStatus = pgEnum("feedback_case_status", FEEDBACK_CASE_STATUSES)

/** The feedback inbox: one case per unhappy survey response, for the manager to follow up. Not the product feedback widget. */
export const feedbackCases = pgTable(
  "feedback_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    responseId: uuid("response_id")
      .notNull()
      .references(() => surveyResponses.id, { onDelete: "cascade" }),
    status: feedbackCaseStatus("status").notNull().default("new"),
    notes: text("notes"),
    handledBy: text("handled_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("feedback_cases_response_unique").on(t.responseId),
    index("feedback_cases_hotel_idx").on(t.hotelId, t.status),
  ],
)
