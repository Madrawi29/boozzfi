import { NextRequest, NextResponse } from "next/server";
import { buildFeatureEnablementPlan } from "@/src/lib/arc/appKitClient";
import { getFeatureById } from "@/src/lib/arc/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ feature: string }> }) {
  const { feature } = await context.params;
  const definition = getFeatureById(feature);
  if (!definition) {
    return NextResponse.json(
      {
        error: "unknown_feature",
        message: `Feature '${feature}' is not registered in the B00ZZ FI Arc integration matrix.`
      },
      { status: 404 }
    );
  }

  const input = await request.json().catch(() => ({}));
  return NextResponse.json({
    feature: definition,
    plan: buildFeatureEnablementPlan(feature, input)
  });
}
