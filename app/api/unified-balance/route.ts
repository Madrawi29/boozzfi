import { NextResponse } from "next/server";
import { getUnifiedBalanceStatus } from "@/src/server/gateway/status";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getUnifiedBalanceStatus());
}
