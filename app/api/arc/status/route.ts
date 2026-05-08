import { NextResponse } from "next/server";
import { getArcRpcStatus } from "@/src/lib/arc/viem";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getArcRpcStatus());
}
