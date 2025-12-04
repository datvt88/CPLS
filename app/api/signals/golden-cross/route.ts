import { NextResponse } from "next/server";
import { getGoldenCrossStocks } from "@/services/goldenCross.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getGoldenCrossStocks();

    return NextResponse.json({
      success: true,
      total: Object.keys(data || {}).length,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Internal server error"
      },
      { status: 500 }
    );
  }
}
