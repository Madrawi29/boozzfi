import { eq } from "drizzle-orm";
import { db, schema } from "@/src/db";
import { ensureDatabase } from "@/src/lib/migrate";
import {
  insertRow,
  isSupabaseConfigured,
  selectRows,
  updateRows,
} from "@/src/server/supabase/rest";
import type { PaymentRecord, PaymentStatus } from "@/src/types/payment";

type PaymentRecordPatch = Partial<
  Pick<
    PaymentRecord,
    | "circleTransactionId"
    | "errorMessage"
    | "invoiceId"
    | "invoiceUrl"
    | "status"
    | "txHash"
    | "xenditStatus"
  >
>;

function now() {
  return new Date();
}

function serializePayment(record: PaymentRecord) {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function deserializePayment(
  record: typeof schema.paymentRecords.$inferSelect,
): PaymentRecord {
  return {
    referenceId: record.referenceId,
    invoiceId: record.invoiceId ?? undefined,
    invoiceUrl: record.invoiceUrl ?? undefined,
    userWallet: record.userWallet,
    idrAmount: record.idrAmount,
    usdcAmount: record.usdcAmount,
    status: record.status as PaymentStatus,
    xenditStatus: record.xenditStatus ?? undefined,
    circleTransactionId: record.circleTransactionId ?? undefined,
    txHash: record.txHash ?? undefined,
    errorMessage: record.errorMessage ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function deserializeSupabasePayment(record: Record<string, unknown>): PaymentRecord {
  return {
    referenceId: String(record.referenceId),
    invoiceId: record.invoiceId ? String(record.invoiceId) : undefined,
    invoiceUrl: record.invoiceUrl ? String(record.invoiceUrl) : undefined,
    userWallet: String(record.userWallet),
    idrAmount: Number(record.idrAmount),
    usdcAmount: String(record.usdcAmount),
    status: String(record.status) as PaymentStatus,
    xenditStatus: record.xenditStatus ? String(record.xenditStatus) : undefined,
    circleTransactionId: record.circleTransactionId
      ? String(record.circleTransactionId)
      : undefined,
    txHash: record.txHash ? String(record.txHash) : undefined,
    errorMessage: record.errorMessage ? String(record.errorMessage) : undefined,
    createdAt: new Date(String(record.createdAt)).toISOString(),
    updatedAt: new Date(String(record.updatedAt)).toISOString(),
  };
}

export async function createPaymentRecord(
  input: Omit<PaymentRecord, "createdAt" | "updatedAt">,
) {
  const timestamp = new Date().toISOString();
  const record: PaymentRecord = {
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (isSupabaseConfigured()) {
    try {
      const row = await insertRow<Record<string, unknown>>("payment_records", record);
      return row ? deserializeSupabasePayment(row) : record;
    } catch (error) {
      console.warn("Supabase payment insert failed; falling back to local database.", error);
    }
  }

  await ensureDatabase();
  await db.insert(schema.paymentRecords).values(serializePayment(record));
  return record;
}

export async function findPaymentRecord(referenceId: string | undefined | null) {
  if (!referenceId) return null;

  if (isSupabaseConfigured()) {
    try {
      const rows = await selectRows<Record<string, unknown>>("payment_records", {
        filters: { referenceId },
        limit: 1,
      });
      return rows[0] ? deserializeSupabasePayment(rows[0]) : null;
    } catch (error) {
      console.warn("Supabase payment lookup failed; falling back to local database.", error);
    }
  }

  await ensureDatabase();

  const [record] = await db
    .select()
    .from(schema.paymentRecords)
    .where(eq(schema.paymentRecords.referenceId, referenceId))
    .limit(1);

  return record ? deserializePayment(record) : null;
}

export async function findPaymentRecordByInvoiceId(
  invoiceId: string | undefined | null,
) {
  if (!invoiceId) return null;

  if (isSupabaseConfigured()) {
    try {
      const rows = await selectRows<Record<string, unknown>>("payment_records", {
        filters: { invoiceId },
        limit: 1,
      });
      return rows[0] ? deserializeSupabasePayment(rows[0]) : null;
    } catch (error) {
      console.warn("Supabase payment invoice lookup failed; falling back to local database.", error);
    }
  }

  await ensureDatabase();

  const [record] = await db
    .select()
    .from(schema.paymentRecords)
    .where(eq(schema.paymentRecords.invoiceId, invoiceId))
    .limit(1);

  return record ? deserializePayment(record) : null;
}

export async function updatePaymentRecord(
  referenceId: string,
  patch: PaymentRecordPatch,
) {
  if (isSupabaseConfigured()) {
    try {
      const rows = await updateRows<Record<string, unknown>>(
        "payment_records",
        { referenceId },
        {
          ...patch,
          updatedAt: now().toISOString(),
        },
      );
      return rows[0] ? deserializeSupabasePayment(rows[0]) : null;
    } catch (error) {
      console.warn("Supabase payment update failed; falling back to local database.", error);
    }
  }

  await ensureDatabase();

  const existing = await findPaymentRecord(referenceId);
  if (!existing) return null;

  await db
    .update(schema.paymentRecords)
    .set({
      ...patch,
      updatedAt: now(),
    })
    .where(eq(schema.paymentRecords.referenceId, referenceId));

  return findPaymentRecord(referenceId);
}

export async function markPaymentStatus(
  referenceId: string,
  status: PaymentStatus,
  patch: Omit<PaymentRecordPatch, "status"> = {},
) {
  return updatePaymentRecord(referenceId, { ...patch, status });
}
