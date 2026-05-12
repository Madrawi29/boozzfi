import { eq } from "drizzle-orm";
import { db, schema } from "@/src/db";
import { ensureDatabase } from "@/src/lib/migrate";
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

export async function createPaymentRecord(
  input: Omit<PaymentRecord, "createdAt" | "updatedAt">,
) {
  await ensureDatabase();

  const timestamp = new Date().toISOString();
  const record: PaymentRecord = {
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.insert(schema.paymentRecords).values(serializePayment(record));
  return record;
}

export async function findPaymentRecord(referenceId: string | undefined | null) {
  if (!referenceId) return null;
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
