import { NextResponse } from "next/server";
import { getDashboard } from "@/src/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await getDashboard();
  return NextResponse.json({
    active: dashboard.network,
    distribution: dashboard.chainDistribution
  });
}
