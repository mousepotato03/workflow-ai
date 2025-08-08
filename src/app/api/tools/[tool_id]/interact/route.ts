import { NextRequest, NextResponse } from "next/server";

// Feature removed: Tool interactions no longer supported
export async function POST(
  _request: NextRequest,
  _ctx: { params: Promise<{ tool_id: string }> }
) {
  return NextResponse.json(
    { error: "Tool interactions feature has been removed" },
    { status: 410 }
  );
}
