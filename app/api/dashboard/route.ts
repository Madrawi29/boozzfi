import { NextResponse } from "next/server";
import { getDashboard } from "@/src/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getDashboard());
}
