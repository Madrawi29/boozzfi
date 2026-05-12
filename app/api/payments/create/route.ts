import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { addActivity } from "@/src/lib/repository";
import { createPaymentRecord } from "@/src/lib/payments/store";
import { createXenditInvoice } from "@/src/lib/xendit/createInvoice";

export const dynamic = "force-dynamic";

type CreatePaymentInput = {
  idrAmount?: unknown;
  userWallet?: unknown;
};

function calculateTestUsdcAmount(idrAmount: number) {
  // TODO: Replace this fixed sandbox conversion with a real FX quote before production.
  const usdcAmount = (idrAmount * 6) / 100000;
  return usdcAmount.toFixed(6).replace(/\.?0+$/, "");
}

function getShortWallet(address: Address) {
  return `${address.slice(2, 8)}${address.slice(-4)}`.toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreatePaymentInput;
    const userWallet = String(body.userWallet ?? "");
    const idrAmount = Number(body.idrAmount);

    if (!isAddress(userWallet)) {
      return NextResponse.json(
        { error: "bad_request", message: "userWallet must be a valid EVM address." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(idrAmount) || idrAmount <= 0) {
      return NextResponse.json(
        { error: "bad_request", message: "idrAmount must be greater than 0." },
        { status: 400 },
      );
    }

    const walletAddress = userWallet as Address;
    const referenceId = `boozzfi-${Date.now()}-${getShortWallet(walletAddress)}`;
    const usdcAmount = calculateTestUsdcAmount(idrAmount);
    const invoice = await createXenditInvoice({ idrAmount, referenceId });

    const payment = await createPaymentRecord({
      referenceId,
      invoiceId: invoice.invoiceId,
      invoiceUrl: invoice.invoiceUrl,
      userWallet: walletAddress,
      idrAmount,
      usdcAmount,
      status: "pending",
      xenditStatus: invoice.status,
    });

    await addActivity({
      walletAddress,
      type: "Buy USDC",
      asset: "Xendit Test Mode to Arc Testnet USDC",
      amount: Number(usdcAmount),
      status: "Pending",
      txHash: referenceId,
    });

    return NextResponse.json({
      referenceId: payment.referenceId,
      invoiceId: payment.invoiceId,
      invoiceUrl: payment.invoiceUrl,
      idrAmount: payment.idrAmount,
      usdcAmount: payment.usdcAmount,
      status: payment.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "payment_create_failed",
        message:
          error instanceof Error
            ? error.message
            : "Unable to create Xendit payment link.",
      },
      { status: 500 },
    );
  }
}
