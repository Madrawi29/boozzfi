import { NextRequest, NextResponse } from "next/server";
import { createWorkflow } from "@/src/lib/repository";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const input = await request.json();
  const workflow = await createWorkflow(input);
  return NextResponse.json({ workflow }, { status: 201 });
}
