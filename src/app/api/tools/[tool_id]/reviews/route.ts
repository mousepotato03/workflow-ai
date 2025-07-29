import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const reviewSchema = z.object({
  content: z.string().min(10).max(1000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool_id: string }> }
) {
  try {
    const { tool_id } = await params;
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // 요청 본문 검증
    const body = await request.json();
    const validatedData = reviewSchema.parse(body);

    // tool_id가 유효한 UUID인지 확인
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tool_id
      )
    ) {
      return NextResponse.json(
        { error: "Invalid tool ID format" },
        { status: 400 }
      );
    }

    // 도구가 존재하는지 확인
    const { data: tool, error: toolError } = await supabase
      .from("tools")
      .select("id")
      .eq("id", tool_id)
      .eq("is_active", true)
      .single();

    if (toolError || !tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // 리뷰 생성
    const { data: newReview, error: insertError } = await supabase
      .from("reviews")
      .insert({
        user_id: user.id,
        tool_id,
        content: validatedData.content,
      })
      .select(
        `
        id,
        content,
        created_at,
        updated_at,
        user:users(id, full_name, avatar_url)
      `
      )
      .single();

    if (insertError) {
      console.error("Insert review error:", insertError);
      return NextResponse.json(
        { error: "Failed to create review" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Review created successfully",
        data: newReview,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Review API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool_id: string }> }
) {
  try {
    const { tool_id } = await params;
    const supabase = await createClient();

    // tool_id가 유효한 UUID인지 확인
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tool_id
      )
    ) {
      return NextResponse.json(
        { error: "Invalid tool ID format" },
        { status: 400 }
      );
    }

    // 페이지네이션 파라미터
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(url.searchParams.get("limit") || "10"))
    );
    const offset = (page - 1) * limit;

    // 리뷰 조회
    const { data: reviews, error: reviewsError } = await supabase
      .from("reviews")
      .select(
        `
        id,
        content,
        created_at,
        updated_at,
        user:users(id, full_name, avatar_url)
      `
      )
      .eq("tool_id", tool_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (reviewsError) {
      console.error("Fetch reviews error:", reviewsError);
      return NextResponse.json(
        { error: "Failed to fetch reviews" },
        { status: 500 }
      );
    }

    // 총 리뷰 수 조회
    const { count, error: countError } = await supabase
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .eq("tool_id", tool_id);

    if (countError) {
      console.error("Count reviews error:", countError);
      return NextResponse.json(
        { error: "Failed to count reviews" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: reviews,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Reviews API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
