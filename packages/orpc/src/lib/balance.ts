import { balanceLedger, type Db, hotelBalance } from "@ritorno/db"
import { and, desc, eq, gte, sql } from "drizzle-orm"

export async function getBalance(db: Db, hotelId: string): Promise<number> {
  const [row] = await db
    .select({ balance: hotelBalance.balanceMillimes })
    .from(hotelBalance)
    .where(eq(hotelBalance.hotelId, hotelId))
  return row?.balance ?? 0
}

export async function topUp(
  db: Db,
  hotelId: string,
  millimes: number,
  entry: { createdBy?: string | null; note?: string | null; kind?: "top_up" | "refund"; messageId?: string } = {},
): Promise<number> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(hotelBalance)
      .values({ hotelId, balanceMillimes: millimes })
      .onConflictDoUpdate({
        target: hotelBalance.hotelId,
        set: { balanceMillimes: sql`${hotelBalance.balanceMillimes} + ${millimes}` },
      })
      .returning({ balance: hotelBalance.balanceMillimes })
    await tx.insert(balanceLedger).values({
      hotelId,
      kind: entry.kind ?? "top_up",
      amountMillimes: millimes,
      messageId: entry.messageId,
      note: entry.note,
      createdBy: entry.createdBy,
    })
    return row!.balance
  })
}

/** Takes the price off the balance, or does nothing and says false when the balance is short. Atomic. */
export async function debit(db: Db, hotelId: string, millimes: number, messageId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(hotelBalance)
      .set({ balanceMillimes: sql`${hotelBalance.balanceMillimes} - ${millimes}` })
      .where(and(eq(hotelBalance.hotelId, hotelId), gte(hotelBalance.balanceMillimes, millimes)))
      .returning({ id: hotelBalance.hotelId })
    if (rows.length === 0) return false
    await tx.insert(balanceLedger).values({ hotelId, kind: "usage", amountMillimes: -millimes, messageId })
    return true
  })
}

/** Gives a debited price back when the provider refused the message. */
export const refund = (db: Db, hotelId: string, millimes: number, messageId: string) =>
  topUp(db, hotelId, millimes, { kind: "refund", messageId })

/** What the hotel spent since `since`: usage minus refunds, and how many messages that was. */
export async function usageSince(db: Db, hotelId: string, since: Date) {
  const [row] = await db
    .select({
      spent: sql<number>`coalesce(-sum(${balanceLedger.amountMillimes}) filter (where ${balanceLedger.kind} <> 'top_up'), 0)::int`,
      messages: sql<number>`(count(*) filter (where ${balanceLedger.kind} = 'usage') - count(*) filter (where ${balanceLedger.kind} = 'refund'))::int`,
    })
    .from(balanceLedger)
    .where(and(eq(balanceLedger.hotelId, hotelId), gte(balanceLedger.createdAt, since)))
  return { spentMillimes: row?.spent ?? 0, messages: row?.messages ?? 0 }
}

export const recentLedger = (db: Db, hotelId: string, limit = 20) =>
  db
    .select({
      id: balanceLedger.id,
      kind: balanceLedger.kind,
      amountMillimes: balanceLedger.amountMillimes,
      note: balanceLedger.note,
      createdAt: balanceLedger.createdAt,
    })
    .from(balanceLedger)
    .where(eq(balanceLedger.hotelId, hotelId))
    .orderBy(desc(balanceLedger.createdAt))
    .limit(limit)
