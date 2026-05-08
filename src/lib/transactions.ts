import type { Hash } from "viem";
import { arcPublicClient } from "@/src/lib/arc/viem";

export async function waitForArcTransactionStatus(txHash: Hash) {
  const receipt = await arcPublicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  return receipt.status === "success" ? "Success" : "Failed";
}
