import { NextResponse } from "next/server";
import { getCircleManagedWalletReadiness } from "@/src/server/circle/wallets";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getCircleManagedWalletReadiness());
}
