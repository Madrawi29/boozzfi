import { NextRequest, NextResponse } from "next/server";
import { buildTransactionPreview } from "@/src/lib/repository";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const input = await request.json();
  const result = await buildTransactionPreview(input);
  if ("errors" in result) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: "Transaction preview payload is invalid",
        details: result.errors
      },
      { status: 400 }
    );
  }
  return NextResponse.json(result);
}
