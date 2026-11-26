import type { AuditAction } from "@ritorno/common/audit"
import { auditLog } from "@ritorno/db"
import type { Context } from "../context"
import type { ActiveHotel } from "./hotel"

export interface AuditEntry {
  /** `noun.verb`, e.g. `note.delete`. */
  action: AuditAction
  targetId?: string
  metadata?: Record<string, unknown>
}

/** Records what the caller just did. The hotel the caller acts on is kept in `metadata.hotelId`, so the admin can filter by hotel. A failing audit write is logged, never allowed to fail the action itself. */
export async function audit(
  context: Pick<Context, "db" | "session" | "headers"> & { hotel?: ActiveHotel },
  entry: AuditEntry,
): Promise<void> {
  const forwarded = context.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  try {
    await context.db.insert(auditLog).values({
      actorId: context.session?.user.id ?? null,
      action: entry.action,
      targetId: entry.targetId,
      metadata: context.hotel ? { hotelId: context.hotel.hotelId, ...entry.metadata } : entry.metadata,
      ip: forwarded || context.headers.get("x-real-ip"),
    })
  } catch (error) {
    console.error("[audit]", entry.action, error)
  }
}
