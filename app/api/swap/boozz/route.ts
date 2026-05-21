import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  getAddress,
  http,
  isAddress,
  parseAbi,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnetChain } from "@/src/lib/arc/viem";
import { ARC_TESTNET } from "@/src/lib/arc/config";

export const dynamic = "force-dynamic";

const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const TREASURY_ADDRESS = "0x32c6336489F0bd3f5C17Bb56a157b71DdA99De78";

const BOOZZ_ABI = parseAbi([
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

const TRANSFER_EVENT_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

function getBoozzAmount(usdcAmount: bigint) {
  // BOOZZ MVP reference price: 1 BOOZZ = 0.30 USDC.
  return (usdcAmount * 1_000_000_000_000n * 10n) / 3n;
}

function normalizePrivateKey(value: string | undefined) {
  if (!value) return "";
  return value.startsWith("0x") ? value : `0x${value}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      amountIn?: string;
      recipient?: string;
      usdcTxHash?: string;
    };
    const amountIn = body.amountIn?.trim() ?? "";
    const recipient = body.recipient?.trim() ?? "";
    const usdcTxHash = body.usdcTxHash?.trim() ?? "";
    const boozzTokenAddress = process.env.NEXT_PUBLIC_BOOZZ_TOKEN_ADDRESS;
    const privateKey = normalizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY);

    if (!amountIn || Number(amountIn) <= 0) {
      return NextResponse.json(
        { error: "bad_request", message: "USDC amount is required." },
        { status: 400 },
      );
    }
    if (!isAddress(recipient)) {
      return NextResponse.json(
        { error: "bad_request", message: "Recipient wallet is invalid." },
        { status: 400 },
      );
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(usdcTxHash)) {
      return NextResponse.json(
        { error: "bad_request", message: "USDC payment tx hash is invalid." },
        { status: 400 },
      );
    }
    if (!boozzTokenAddress || !isAddress(boozzTokenAddress)) {
      return NextResponse.json(
        { error: "server_config", message: "BOOZZ token address is not configured." },
        { status: 500 },
      );
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
      return NextResponse.json(
        { error: "server_config", message: "BOOZZ treasury private key is not configured." },
        { status: 500 },
      );
    }

    const publicClient = createPublicClient({
      chain: arcTestnetChain,
      transport: http(ARC_TESTNET.rpcUrl),
    });
    const receipt = await publicClient.getTransactionReceipt({
      hash: usdcTxHash as Hash,
    });
    const expectedUsdcAmount = parseUnits(amountIn, 6);
    const normalizedRecipient = getAddress(recipient);
    const normalizedTreasury = getAddress(TREASURY_ADDRESS);
    const normalizedUsdc = getAddress(ARC_USDC_ADDRESS);

    if (receipt.status !== "success") {
      return NextResponse.json(
        { error: "payment_failed", message: "USDC payment transaction failed." },
        { status: 400 },
      );
    }

    const paidAmount = receipt.logs.reduce((total, log) => {
      if (getAddress(log.address) !== normalizedUsdc) return total;

      try {
        const decoded = decodeEventLog({
          abi: TRANSFER_EVENT_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName !== "Transfer") return total;

        const { from, to, value } = decoded.args;
        if (
          getAddress(from as Address) === normalizedRecipient &&
          getAddress(to as Address) === normalizedTreasury
        ) {
          return total + (value as bigint);
        }
      } catch {
        return total;
      }

      return total;
    }, 0n);

    if (paidAmount < expectedUsdcAmount) {
      return NextResponse.json(
        {
          error: "payment_not_found",
          message: "No matching USDC transfer to the BOOZZ treasury was found.",
        },
        { status: 400 },
      );
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    if (getAddress(account.address) !== normalizedTreasury) {
      return NextResponse.json(
        { error: "server_config", message: "BOOZZ treasury key does not match treasury address." },
        { status: 500 },
      );
    }

    const boozzAmount = getBoozzAmount(expectedUsdcAmount);
    const treasuryBalance = (await publicClient.readContract({
      address: boozzTokenAddress,
      abi: BOOZZ_ABI,
      functionName: "balanceOf",
      args: [account.address],
    })) as bigint;

    if (treasuryBalance < boozzAmount) {
      return NextResponse.json(
        { error: "insufficient_treasury", message: "BOOZZ treasury balance is too low." },
        { status: 400 },
      );
    }

    const walletClient = createWalletClient({
      account,
      chain: arcTestnetChain,
      transport: http(ARC_TESTNET.rpcUrl),
    });
    const txHash = await walletClient.writeContract({
      address: boozzTokenAddress,
      abi: BOOZZ_ABI,
      functionName: "transfer",
      args: [normalizedRecipient, boozzAmount],
    });

    return NextResponse.json({
      boozzAmount: boozzAmount.toString(),
      txHash,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "swap_failed",
        message: error instanceof Error ? error.message : "BOOZZ swap failed.",
      },
      { status: 500 },
    );
  }
}
