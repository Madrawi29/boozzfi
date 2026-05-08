import { NextResponse } from "next/server";
import { ARC_TESTNET, FEATURE_MATRIX, PUBLIC_ARC_ENV, getArcAddChainParameters } from "@/src/lib/arc/config";
import { getAppKitReadiness } from "@/src/lib/arc/appKitClient";
import { getCircleManagedWalletReadiness } from "@/src/server/circle/wallets";
import { getUnifiedBalanceStatus } from "@/src/server/gateway/status";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    arc: ARC_TESTNET,
    addChainParameters: getArcAddChainParameters(),
    publicEnv: PUBLIC_ARC_ENV,
    appKit: getAppKitReadiness(),
    managedWallet: getCircleManagedWalletReadiness(),
    unifiedBalance: getUnifiedBalanceStatus(),
    features: FEATURE_MATRIX
  });
}
