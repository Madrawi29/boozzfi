import { NextResponse } from "next/server";
import { ARC_TESTNET, getArcAddChainParameters } from "@/src/lib/arc/config";

export function GET() {
  return NextResponse.json({
    chain: ARC_TESTNET,
    addChainParameters: getArcAddChainParameters(),
    privy: {
      switchChainId: ARC_TESTNET.chainId,
      defaultChain: "Arc Testnet",
    },
  });
}
