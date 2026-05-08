import { NextResponse } from "next/server";
import { FEATURE_MATRIX } from "@/src/lib/arc/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ features: FEATURE_MATRIX });
}
