import { isAddress, type Address } from "viem";
import { addActivity, finalizeActivityTransaction } from "@/src/lib/repository";
import {
  getCircleTreasuryTransaction,
  sendUsdcFromTreasury,
} from "@/src/lib/circle/sendUsdcFromTreasury";
import { markPaymentStatus } from "@/src/lib/payments/store";
import type { PaymentRecord } from "@/src/types/payment";

export function isPaidXenditStatus(status: string) {
  return ["PAID", "SETTLED", "SUCCEEDED", "COMPLETED"].includes(
    status.toUpperCase(),
  );
}

export function isFailedXenditStatus(status: string) {
  return ["EXPIRED", "FAILED", "VOIDED"].includes(status.toUpperCase());
}

export async function markBuyUsdcActivityFailed(
  payment: PaymentRecord,
  errorMessage: string,
  xenditStatus?: string,
) {
  await markPaymentStatus(payment.referenceId, "failed", {
    errorMessage,
    xenditStatus,
  });

  const failedActivity = await finalizeActivityTransaction({
    currentTxHash: payment.referenceId,
    status: "Failed",
  });

  if ("errors" in failedActivity) {
    await addActivity({
      walletAddress: payment.userWallet,
      type: "Buy USDC",
      asset: "Xendit Test Mode to Arc Testnet USDC",
      amount: Number(payment.usdcAmount),
      status: "Failed",
      txHash: payment.referenceId,
    });
  }
}

export async function processPaidPayment(
  payment: PaymentRecord,
  xenditStatus: string,
) {
  if (payment.status === "completed") {
    await finalizeActivityTransaction({
      currentTxHash: payment.referenceId,
      nextTxHash: payment.txHash ?? payment.circleTransactionId ?? payment.referenceId,
      status: "Success",
    });
    return payment;
  }

  if (payment.status === "sending") {
    return payment;
  }

  if (!isAddress(payment.userWallet)) {
    await markBuyUsdcActivityFailed(
      payment,
      "Stored payment wallet is invalid.",
      xenditStatus,
    );
    throw new Error("Stored payment wallet is invalid.");
  }

  await markPaymentStatus(payment.referenceId, "sending", { xenditStatus });

  let circleResult: Awaited<ReturnType<typeof sendUsdcFromTreasury>>;
  try {
    circleResult = await sendUsdcFromTreasury({
      amount: payment.usdcAmount,
      referenceId: payment.referenceId,
      to: payment.userWallet as Address,
    });
  } catch (error) {
    await markBuyUsdcActivityFailed(
      payment,
      error instanceof Error ? error.message : "Circle treasury transfer failed.",
      xenditStatus,
    );
    throw error;
  }

  const finalTxHash =
    circleResult.txHash ?? circleResult.circleTransactionId ?? payment.referenceId;
  const isComplete =
    circleResult.state === "COMPLETE" || Boolean(circleResult.txHash);

  if (!isComplete) {
    return (
      (await markPaymentStatus(payment.referenceId, "sending", {
        circleTransactionId: circleResult.circleTransactionId,
        xenditStatus,
      })) ?? payment
    );
  }

  const completed = await markPaymentStatus(payment.referenceId, "completed", {
    circleTransactionId: circleResult.circleTransactionId,
    txHash: circleResult.txHash,
    xenditStatus,
  });

  const finalizedActivity = await finalizeActivityTransaction({
    currentTxHash: payment.referenceId,
    nextTxHash: finalTxHash,
    status: "Success",
  });

  if ("errors" in finalizedActivity) {
    await addActivity({
      walletAddress: payment.userWallet,
      type: "Buy USDC",
      asset: "Xendit Test Mode to Arc Testnet USDC",
      amount: Number(payment.usdcAmount),
      status: "Success",
      txHash: finalTxHash,
    });
  }

  return completed ?? payment;
}

export async function refreshCirclePayment(payment: PaymentRecord) {
  if (!payment.circleTransactionId) return payment;

  const transaction = await getCircleTreasuryTransaction(
    payment.circleTransactionId,
  );

  if (["CANCELLED", "DENIED", "FAILED"].includes(transaction.state ?? "")) {
    await markBuyUsdcActivityFailed(
      payment,
      `Circle transfer ended in state: ${transaction.state}.`,
      payment.xenditStatus,
    );
    return (
      (await markPaymentStatus(payment.referenceId, "failed", {
        circleTransactionId: payment.circleTransactionId,
        errorMessage: `Circle transfer ended in state: ${transaction.state}.`,
        txHash: transaction.txHash,
      })) ?? payment
    );
  }

  if (transaction.state === "COMPLETE" || transaction.txHash) {
    const finalTxHash =
      transaction.txHash ?? payment.circleTransactionId ?? payment.referenceId;
    const completed = await markPaymentStatus(payment.referenceId, "completed", {
      circleTransactionId: payment.circleTransactionId,
      txHash: transaction.txHash,
    });

    await finalizeActivityTransaction({
      currentTxHash: payment.referenceId,
      nextTxHash: finalTxHash,
      status: "Success",
    });

    return completed ?? payment;
  }

  return (
    (await markPaymentStatus(payment.referenceId, "sending", {
      circleTransactionId: payment.circleTransactionId,
      txHash: transaction.txHash,
    })) ?? payment
  );
}
