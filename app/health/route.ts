import { NextResponse } from "next/server";
import { getDashboard } from "@/src/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const dashboard = await getDashboard();
  return NextResponse.json({
    ok: true,
    product: "B00ZZ FI",
    network: dashboard.network.name,
    status: dashboard.network.status,
    timestamp: new Date().toISOString()
  });
}
