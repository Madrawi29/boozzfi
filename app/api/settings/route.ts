import { NextRequest, NextResponse } from "next/server";
import { updateSettings } from "@/src/lib/repository";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const input = await request.json();
  const settings = await updateSettings(input);
  return NextResponse.json({ settings });
}
