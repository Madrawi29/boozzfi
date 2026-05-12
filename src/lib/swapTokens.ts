import type { ConnectedWallet } from "@privy-io/react-auth";
import type { Address } from "viem";
import {
  BROWSER_SWAP_PROXY_KIT_KEY,
  withCircleStablecoinProxy,
} from "@/src/lib/circleStablecoinProxy";
import { createCircleAppKit } from "./circleAppKit";
import { getPrivyAdapter } from "./privyAdapter";

export type SwapToken = "USDC" | "EURC" | "cirBTC";
const ARC_SWAP_CHAIN = "Arc_Testnet";
const ARC_SWAP_DOCS_TOKENS = "USDC, EURC, and cirBTC";

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
    return `${error.message} Check that the server KIT_KEY is a Circle Kit Key with Arc Testnet Swap access, then retry with a funded Arc Testnet wallet.`;
  }

  if (isUnsupportedSwapRouteError(error)) {
    return `Arc docs list ${ARC_SWAP_DOCS_TOKENS} as swap tokens on ${ARC_SWAP_CHAIN}, but Circle service returned no route for ${tokenIn} to ${tokenOut}. Check that the server KIT_KEY is a Circle Kit Key with Arc Testnet Swap access, then retry with a funded Arc Testnet wallet.`;
  }

  return error instanceof Error ? error.message : "Swap failed.";
}

export async function swapTokens(
  tokenIn: SwapToken,
  tokenOut: SwapToken,
  amountIn: string,
  wallet: ConnectedWallet
) {
  if (!wallet) throw new Error("Privy wallet not found");

  const adapter = await getPrivyAdapter(wallet);
  const kit = createCircleAppKit();

  try {
    return await withCircleStablecoinProxy(() => {
      return kit.swap({
        from: {
          adapter,
          chain: ARC_SWAP_CHAIN,
          address: wallet.address as Address,
        },
        tokenIn,
        tokenOut,
        amountIn,
        config: {
          kitKey: BROWSER_SWAP_PROXY_KIT_KEY,
        },
      });
    });
  } catch (error) {
    if (isUnsupportedSwapRouteError(error)) {
      throw new SwapRouteUnavailableError(tokenIn, tokenOut);
    }

    throw error;
  }
}
