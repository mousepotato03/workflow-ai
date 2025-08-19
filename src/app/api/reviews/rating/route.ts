import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Submit rating (one-time only per user per tool)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 사용자 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    const { tool_id, rating } = await request.json();

    if (!tool_id || !rating) {
      return NextResponse.json(
        { error: "도구 ID와 별점이 필요합니다." },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "별점은 1~5 사이의 값이어야 합니다." },
        { status: 400 }
      );
    }

    // 이미 평점을 남겼는지 확인
    const { data: existingRating } = await supabase
      .from("reviews")
      .select("id, rating")
      .eq("user_id", user.id)
      .eq("tool_id", tool_id)
      .single();

    if (existingRating) {
      return NextResponse.json(
        { error: "이미 이 도구에 대한 평점을 제출했습니다." },
        { status: 400 }
      );
    }

    // 평점만 저장 (코멘트는 별도로 처리)
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        user_id: user.id,
        tool_id: tool_id,
        rating: rating,
        comment: null, // 평점은 코멘트 없이 저장
      })
      .select(
        `
        id,
        rating,
        created_at,
        users!reviews_user_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `
      )
      .single();

    if (error) {
      console.error("Rating insert error:", error);
      return NextResponse.json(
        { error: "평점 저장 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "평점이 저장되었습니다.",
      rating: data,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}