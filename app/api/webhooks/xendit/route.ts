import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { finalizeActivityTransaction } from "@/src/lib/repository";
import {
  findPaymentRecord,
  findPaymentRecordByInvoiceId,
  markPaymentStatus,
} from "@/src/lib/payments/store";
import {
  isFailedXenditStatus,
  isPaidXenditStatus,
  markBuyUsdcActivityFailed,
  processPaidPayment,
} from "@/src/lib/payments/processPaidPayment";

export const dynamic = "force-dynamic";

type XenditWebhookPayload = {
  data?: XenditWebhookPayload;
  external_id?: string;
  id?: string;
  reference_id?: string;
  status?: string;
};

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getConfiguredCallbackToken() {
  const token = process.env.XENDIT_CALLBACK_TOKEN?.trim();
  if (!token) {
    throw new Error("XENDIT_CALLBACK_TOKEN is not configured on the server.");
  }

  return token;
}

function getWebhookData(payload: XenditWebhookPayload) {
  return payload.data ?? payload;
}

function getReferenceId(payload: XenditWebhookPayload) {
  const data = getWebhookData(payload);
  return data.external_id ?? data.reference_id ?? null;
}

function getInvoiceId(payload: XenditWebhookPayload) {
  const data = getWebhookData(payload);
  return data.id ?? null;
}

function getXenditStatus(payload: XenditWebhookPayload) {
  const data = getWebhookData(payload);
  return String(data.status ?? "").toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const configuredToken = getConfiguredCallbackToken();
    const callbackToken = request.headers.get("x-callback-token") ?? "";

    if (!safeEquals(callbackToken, configuredToken)) {
      return NextResponse.json(
        { error: "forbidden", message: "Invalid Xendit callback token." },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as XenditWebhookPayload;
    const referenceId = getReferenceId(payload);
    const invoiceId = getInvoiceId(payload);
    const xenditStatus = getXenditStatus(payload);

    console.info("Xendit webhook received", {
      hasReferenceId: Boolean(referenceId),
      invoiceId,
      status: xenditStatus,
    });

    const payment =
      (await findPaymentRecord(referenceId)) ??
      (await findPaymentRecordByInvoiceId(invoiceId));

    if (!payment) {
      return NextResponse.json({
        message: "valid webhook received, but payment record was not found",
      });
    }

    if (payment.status === "completed") {
      await finalizeActivityTransaction({
        currentTxHash: payment.referenceId,
        nextTxHash:
          payment.txHash ?? payment.circleTransactionId ?? payment.referenceId,
        status: "Success",
      });
      return NextResponse.json({ message: "already processed" });
    }

    if (payment.status === "sending") {
      return NextResponse.json({ message: "already processed" });
    }

    if (isFailedXenditStatus(xenditStatus)) {
      await markBuyUsdcActivityFailed(
        payment,
        `Xendit invoice status is ${xenditStatus}.`,
        xenditStatus,
      );
      return NextResponse.json({ message: "payment failed or expired" });
    }

    if (!isPaidXenditStatus(xenditStatus)) {
      await markPaymentStatus(payment.referenceId, "pending", { xenditStatus });
      return NextResponse.json({ message: "payment not completed yet" });
    }

    const completed = await processPaidPayment(payment, xenditStatus);

    return NextResponse.json({
      message: "processed",
      payment: {
        referenceId: completed?.referenceId,
        status: completed?.status,
        circleTransactionId: completed?.circleTransactionId,
        txHash: completed?.txHash,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "xendit_webhook_failed",
        message:
          error instanceof Error ? error.message : "Unable to process webhook.",
      },
      { status: 500 },
    );
  }
}
