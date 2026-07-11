import { NextResponse } from "next/server";
import { appraiseVehicle, type AppraisalInput } from "@/lib/ai-appraiser";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AppraisalInput>;

    if (body.purchasePrice == null || !body.condition) {
      return NextResponse.json(
        { error: "condition and purchasePrice are required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "AI API key not configured" },
        { status: 500 }
      );
    }

    const result = await appraiseVehicle({
      vin: body.vin ?? null,
      photos: Array.isArray(body.photos) ? body.photos : [],
      mileage: body.mileage ?? null,
      condition: body.condition,
      purchasePrice: body.purchasePrice,
      repairEstimate: body.repairEstimate ?? 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/ai-appraiser:", error);
    return NextResponse.json(
      { error: "Failed to appraise vehicle" },
      { status: 500 }
    );
  }
}
