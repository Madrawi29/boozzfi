import type { ConnectedWallet } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import {
  BROWSER_SWAP_PROXY_KIT_KEY,
  withCircleStablecoinProxy,
} from "@/src/lib/circleStablecoinProxy";
import { createCircleAppKit } from "./circleAppKit";
import { arcTestnetChain } from "./arc/viem";
import { getPrivyAdapter } from "./privyAdapter";

export type SwapToken = "USDC" | "EURC" | "cirBTC" | "BOOZZ";

const ARC_SWAP_CHAIN = "Arc_Testnet";
const ARC_SWAP_DOCS_TOKENS = "USDC, EURC, cirBTC, and BOOZZ";
const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const BOOZZ_USDC_REFERENCE_PRICE = 0.3;

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export class SwapRouteUnavailableError extends Error {
  constructor(
    readonly tokenIn: SwapToken,
    readonly tokenOut: SwapToken,
  ) {
    super(
      `Arc docs list ${ARC_SWAP_DOCS_TOKENS} as swap tokens on ${ARC_SWAP_CHAIN}, but Circle service returned no route for ${tokenIn} to ${tokenOut}.`,
    );
    this.name = "SwapRouteUnavailableError";
  }
}

function getErrorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
}

function hasAppKitErrorCode(error: unknown, code: string) {
  if (!error || typeof error !== "object") return false;

  const record = error as Record<string, unknown>;
  if (record.name === code || record.code === code) return true;

  const cause = record.cause;
  if (cause && typeof cause === "object") {
    const causeRecord = cause as Record<string, unknown>;
    return causeRecord.name === code || causeRecord.code === code;
  }

  return false;
}

export function isUnsupportedSwapRouteError(error: unknown) {
  const text = getErrorText(error);

  return (
    hasAppKitErrorCode(error, "INPUT_UNSUPPORTED_ROUTE") ||
    text.includes("INPUT_UNSUPPORTED_ROUTE") ||
    text.includes("No route available") ||
    text.includes("Route or resource not found")
  );
}

export function getSwapErrorMessage(
  error: unknown,
  tokenIn: SwapToken,
  tokenOut: SwapToken,
) {
  if (error instanceof SwapRouteUnavailableError) {
    return `${error.message} Pair custom BOOZZ currently supports direct USDC to BOOZZ through the BoozzFi treasury swap.`;
  }

  if (isUnsupportedSwapRouteError(error)) {
    return `Arc docs list ${ARC_SWAP_DOCS_TOKENS} as swap tokens on ${ARC_SWAP_CHAIN}, but Circle service returned no route for ${tokenIn} to ${tokenOut}. Pair custom BOOZZ currently supports direct USDC to BOOZZ through the BoozzFi treasury swap.`;
  }

  return error instanceof Error ? error.message : "Swap failed.";
}

export function getEstimatedSwapOutput(
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountIn: string,
) {
  const amount = Number(amountIn);
  if (!Number.isFinite(amount) || amount <= 0) return "";

  if (tokenIn === "USDC" && tokenOut === "BOOZZ") {
    return (amount / BOOZZ_USDC_REFERENCE_PRICE).toLocaleString("en-US", {
      maximumFractionDigits: 6,
      minimumFractionDigits: 0,
      useGrouping: false,
    });
  }

  return "";
}

async function swapUsdcToBoozz(amountIn: string, wallet: ConnectedWallet) {
  const provider = await wallet.getEthereumProvider();
  const walletClient = createWalletClient({
    chain: arcTestnetChain,
    transport: custom(provider),
  });
  const publicClient = createPublicClient({
    chain: arcTestnetChain,
    transport: custom(provider),
  });
  const [account] = await walletClient.getAddresses();
  const amount = parseUnits(amountIn, 6);

  if (amount <= 0n) {
    throw new Error("Enter a valid USDC amount.");
  }

  const treasuryAddress = (process.env.NEXT_PUBLIC_BOOZZ_TREASURY_ADDRESS ||
    "0x32c6336489F0bd3f5C17Bb56a157b71DdA99De78") as Address;

  const usdcTxHash = await walletClient.writeContract({
    account,
    address: ARC_USDC_ADDRESS,
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [treasuryAddress, amount],
  });

  await publicClient.waitForTransactionReceipt({ hash: usdcTxHash });

  const response = await fetch("/api/swap/boozz", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amountIn,
      recipient: wallet.address,
      usdcTxHash,
    }),
  });

  const payload = (await response.json()) as {
    error?: string;
    message?: string;
    txHash?: Hash;
  };

  if (!response.ok || !payload.txHash) {
    throw new Error(payload.message || payload.error || "BOOZZ swap failed.");
  }

  return {
    paymentTxHash: usdcTxHash,
    txHash: payload.txHash,
  };
}

export async function swapTokens(
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountIn: string,
  wallet: ConnectedWallet,
) {
  if (!wallet) throw new Error("Privy wallet not found");

  if (tokenIn === "USDC" && tokenOut === "BOOZZ") {
    return swapUsdcToBoozz(amountIn, wallet);
  }

  if (tokenIn === "BOOZZ" || tokenOut === "BOOZZ") {
    throw new SwapRouteUnavailableError(tokenIn, tokenOut);
  }

  const adapter = await getPrivyAdapter(wallet);
  const kit = createCircleAppKit();

  try {
    const result = await withCircleStablecoinProxy(() => {
      return kit.swap({
        from: {
          adapter,
          chain: ARC_SWAP_CHAIN,
        },
        tokenIn,
        tokenOut,
        amountIn,
        config: {
          kitKey: BROWSER_SWAP_PROXY_KIT_KEY,
        },
      });
    });

    return {
      txHash: result.txHash as Hash,
    };
  } catch (error) {
    if (isUnsupportedSwapRouteError(error)) {
      throw new SwapRouteUnavailableError(tokenIn, tokenOut);
    }

    throw error;
  }
}
