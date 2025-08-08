import { NextRequest, NextResponse } from "next/server";

// Feature removed: Review endpoints no longer supported
export async function PUT(
  _request: NextRequest,
  _ctx: { params: Promise<{ review_id: string }> }
) {
  return NextResponse.json(
    { error: "Tool reviews feature has been removed" },
    { status: 410 }
  );
}

export async function DELETE(
  _request: NextRequest,
  _ctx: { params: Promise<{ review_id: string }> }
) {
  return NextResponse.json(
    { error: "Tool reviews feature has been removed" },
    { status: 410 }
  );
}

export async function GET(_request: NextRequest, _context: any) {
  return NextResponse.json(
    { error: "Tool reviews feature has been removed" },
    { status: 410 }
  );
}
