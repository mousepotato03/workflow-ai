import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Submit comment (multiple allowed per user per tool)
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

    const { tool_id, comment } = await request.json();

    if (!tool_id || !comment?.trim()) {
      return NextResponse.json(
        { error: "도구 ID와 코멘트가 필요합니다." },
        { status: 400 }
      );
    }

    if (comment.trim().length > 500) {
      return NextResponse.json(
        { error: "코멘트는 500자를 초과할 수 없습니다." },
        { status: 400 }
      );
    }

    // 코멘트만 저장 (평점은 별도로 처리)
    // 코멘트는 여러 개 허용하므로 새로운 레코드를 항상 생성
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        user_id: user.id,
        tool_id: tool_id,
        rating: null, // 코멘트는 평점 없이 저장
        comment: comment.trim(),
      })
      .select(
        `
        id,
        comment,
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
      console.error("Comment insert error:", error);
      return NextResponse.json(
        { error: "코멘트 저장 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "코멘트가 저장되었습니다.",
      comment: data,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}