import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import type { Address } from "viem";

const TERMINAL_TRANSACTION_STATES = new Set([
  "CANCELLED",
  "COMPLETE",
  "DENIED",
  "FAILED",
]);

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured on the server.`);
  }

  return value;
}

function getArcUsdcAddress() {
  const value =
    process.env.USDC_ADDRESS || process.env.NEXT_PUBLIC_USDC_ADDRESS || "";

  if (!value) {
    throw new Error("USDC_ADDRESS is not configured on the server.");
  }

  return value;
}

function getTreasuryWalletAddress() {
  return process.env.CIRCLE_TREASURY_WALLET_ADDRESS?.trim();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendUsdcFromTreasury(params: {
  amount: string;
  referenceId: string;
  to: Address;
}) {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: getRequiredEnv("CIRCLE_API_KEY"),
    entitySecret: getRequiredEnv("CIRCLE_ENTITY_SECRET"),
  });
  getRequiredEnv("CIRCLE_TREASURY_WALLET_ID");
  const walletAddress = getTreasuryWalletAddress();
  const tokenAddress = getArcUsdcAddress();

  if (!walletAddress) {
    throw new Error(
      "CIRCLE_TREASURY_WALLET_ADDRESS is required for Arc Testnet token-address transfers. Add the treasury wallet address from Circle Console to the server env.",
    );
  }

  const transfer = await client.createTransaction({
    amount: [params.amount],
    blockchain: "ARC-TESTNET",
    destinationAddress: params.to,
    fee: {
      type: "level",
      config: {
        feeLevel: "LOW",
      },
    },
    refId: params.referenceId,
    tokenAddress,
    walletAddress,
  });

  const circleTransactionId = transfer.data?.id;
  let state = transfer.data?.state ?? "";
  let txHash: string | undefined;

  if (!circleTransactionId) {
    throw new Error("Circle transfer failed: no transaction ID returned.");
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (TERMINAL_TRANSACTION_STATES.has(state)) break;

    await wait(3000);
    const transactionResponse = await client.getTransaction({
      id: circleTransactionId,
    });
    const transaction = transactionResponse.data?.transaction;
    state = transaction?.state ?? state;
    txHash = transaction?.txHash ?? txHash;
  }

  if (state && ["CANCELLED", "DENIED", "FAILED"].includes(state)) {
    throw new Error(`Circle transfer ended in state: ${state}.`);
  }

  return {
    circleTransactionId,
    state,
    txHash,
  };
}

export async function getCircleTreasuryTransaction(transactionId: string) {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: getRequiredEnv("CIRCLE_API_KEY"),
    entitySecret: getRequiredEnv("CIRCLE_ENTITY_SECRET"),
  });

  const transactionResponse = await client.getTransaction({
    id: transactionId,
  });
  const transaction = transactionResponse.data?.transaction;

  return {
    state: transaction?.state,
    txHash: transaction?.txHash,
  };
}
