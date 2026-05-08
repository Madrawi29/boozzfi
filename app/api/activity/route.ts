import { NextRequest, NextResponse } from "next/server";
import {
  addActivity,
  listActivities,
  updateActivityStatus,
} from "@/src/lib/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const activities = await listActivities({
    type: searchParams.get("type"),
    status: searchParams.get("status"),
    search: searchParams.get("search"),
    walletAddress: searchParams.get("walletAddress")
  });
  return NextResponse.json({ activities });
}

export async function POST(request: NextRequest) {
  const input = await request.json();
  const result = await addActivity(input);
  if ("errors" in result) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: "Activity payload is invalid",
        details: result.errors
      },
      { status: 400 }
    );
  }
  return NextResponse.json({ activity: result.activity }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const input = await request.json();
  const result = await updateActivityStatus(input);
  if ("errors" in result) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: "Activity update payload is invalid",
        details: result.errors
      },
      { status: 400 }
    );
  }
  return NextResponse.json({ activity: result.activity });
}
