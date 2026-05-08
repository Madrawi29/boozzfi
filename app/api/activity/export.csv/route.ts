import { NextRequest } from "next/server";
import { activitiesToCsv, listActivities } from "@/src/lib/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const activities = await listActivities({
    type: searchParams.get("type"),
    status: searchParams.get("status"),
    search: searchParams.get("search")
  });

  return new Response(activitiesToCsv(activities), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=b00zz-fi-activity.csv"
    }
  });
}
