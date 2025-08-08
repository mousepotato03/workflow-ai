import { NextRequest, NextResponse } from "next/server";

// Feature removed: Tool reviews no longer supported
export async function POST(
  _request: NextRequest,
  _ctx: { params: Promise<{ tool_id: string }> }
) {
  return NextResponse.json(
    { error: "Tool reviews feature has been removed" },
    { status: 410 }
  );
}

export async function GET(
  _request: NextRequest,
  _ctx: { params: Promise<{ tool_id: string }> }
) {
  return NextResponse.json(
    { error: "Tool reviews feature has been removed" },
    { status: 410 }
  );
}
