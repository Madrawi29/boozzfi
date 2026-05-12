import { NextRequest, NextResponse } from "next/server";
import {
  findPaymentRecord,
  markPaymentStatus,
} from "@/src/lib/payments/store";
import {
  isFailedXenditStatus,
  isPaidXenditStatus,
  markBuyUsdcActivityFailed,
  processPaidPayment,
  refreshCirclePayment,
} from "@/src/lib/payments/processPaidPayment";
import { getXenditInvoice } from "@/src/lib/xendit/createInvoice";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const referenceId = request.nextUrl.searchParams.get("referenceId");
  let payment = await findPaymentRecord(referenceId);

  if (!payment) {
    return NextResponse.json(
      { error: "not_found", message: "Payment record was not found." },
      { status: 404 },
    );
  }

  if (
    payment.invoiceId &&
    payment.status !== "completed" &&
    payment.status !== "sending"
  ) {
    const invoice = await getXenditInvoice(payment.invoiceId);
    const xenditStatus = invoice.status.toUpperCase();

    if (isPaidXenditStatus(xenditStatus)) {
      payment = await processPaidPayment(payment, xenditStatus);
    } else if (isFailedXenditStatus(xenditStatus)) {
      await markBuyUsdcActivityFailed(
        payment,
        `Xendit invoice status is ${xenditStatus}.`,
        xenditStatus,
      );
      payment = await findPaymentRecord(referenceId);
    } else {
      payment = await markPaymentStatus(payment.referenceId, "pending", {
        xenditStatus,
      });
    }
  } else if (payment.status === "sending") {
    payment = await refreshCirclePayment(payment);
  }

  return NextResponse.json({ payment });
}
