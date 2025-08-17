import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 리뷰 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get("tool_id");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!toolId) {
      return NextResponse.json(
        { error: "도구 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 리뷰 목록 조회
    const { data: reviews, error } = await supabase
      .from("reviews")
      .select(
        `
        id,
        rating,
        comment,
        created_at,
        updated_at,
        users!reviews_user_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `
      )
      .eq("tool_id", toolId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Reviews fetch error:", error);
      return NextResponse.json(
        { error: "리뷰를 가져오는 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    // 평균 별점 및 리뷰 수 조회
    const { data: ratingData, error: ratingError } = await supabase
      .from("tool_ratings")
      .select("review_count, average_rating")
      .eq("tool_id", toolId)
      .single();

    if (ratingError && ratingError.code !== "PGRST116") {
      console.error("Rating fetch error:", ratingError);
    }

    return NextResponse.json({
      reviews: reviews || [],
      reviewCount: ratingData?.review_count || 0,
      averageRating: ratingData?.average_rating || 0,
      hasMore: reviews?.length === limit,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 리뷰 작성/수정
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

    const { tool_id, rating, comment } = await request.json();

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

    // upsert를 사용하여 기존 리뷰가 있으면 업데이트, 없으면 생성
    const { data, error } = await supabase
      .from("reviews")
      .upsert(
        {
          user_id: user.id,
          tool_id: tool_id,
          rating: rating,
          comment: comment || null,
        },
        {
          onConflict: "user_id,tool_id",
        }
      )
      .select(
        `
        id,
        rating,
        comment,
        created_at,
        updated_at,
        users!reviews_user_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `
      )
      .single();

    if (error) {
      console.error("Review upsert error:", error);
      return NextResponse.json(
        { error: "리뷰 저장 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "리뷰가 저장되었습니다.",
      review: data,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 리뷰 삭제
export async function DELETE(request: NextRequest) {
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

    const { tool_id } = await request.json();

    if (!tool_id) {
      return NextResponse.json(
        { error: "도구 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("user_id", user.id)
      .eq("tool_id", tool_id);

    if (error) {
      console.error("Review delete error:", error);
      return NextResponse.json(
        { error: "리뷰 삭제 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "리뷰가 삭제되었습니다.",
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
