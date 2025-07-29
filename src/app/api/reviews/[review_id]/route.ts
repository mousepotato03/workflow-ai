import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const updateReviewSchema = z.object({
  content: z.string().min(10).max(1000),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ review_id: string }> }
) {
  try {
    const { review_id } = await params;
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
    const validatedData = updateReviewSchema.parse(body);

    // review_id가 유효한 숫자인지 확인
    const reviewIdNum = parseInt(review_id);
    if (isNaN(reviewIdNum)) {
      return NextResponse.json(
        { error: "Invalid review ID format" },
        { status: 400 }
      );
    }

    // 리뷰가 존재하고 현재 사용자가 작성자인지 확인
    const { data: existingReview, error: reviewError } = await supabase
      .from("reviews")
      .select("id, user_id")
      .eq("id", reviewIdNum)
      .single();

    if (reviewError || !existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (existingReview.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: You can only edit your own reviews" },
        { status: 403 }
      );
    }

    // 리뷰 업데이트
    const { data: updatedReview, error: updateError } = await supabase
      .from("reviews")
      .update({
        content: validatedData.content,
      })
      .eq("id", reviewIdNum)
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

    if (updateError) {
      console.error("Update review error:", updateError);
      return NextResponse.json(
        { error: "Failed to update review" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Update review API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ review_id: string }> }
) {
  try {
    const { review_id } = await params;
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

    // review_id가 유효한 숫자인지 확인
    const reviewIdNum = parseInt(review_id);
    if (isNaN(reviewIdNum)) {
      return NextResponse.json(
        { error: "Invalid review ID format" },
        { status: 400 }
      );
    }

    // 리뷰가 존재하고 현재 사용자가 작성자인지 확인
    const { data: existingReview, error: reviewError } = await supabase
      .from("reviews")
      .select("id, user_id")
      .eq("id", reviewIdNum)
      .single();

    if (reviewError || !existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    if (existingReview.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: You can only delete your own reviews" },
        { status: 403 }
      );
    }

    // 리뷰 삭제
    const { error: deleteError } = await supabase
      .from("reviews")
      .delete()
      .eq("id", reviewIdNum);

    if (deleteError) {
      console.error("Delete review error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete review" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Get single review
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { review_id } = await context.params;

    // Create Supabase client
    const supabase = await createClient();

    // Get review with user information
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select(
        `
        *,
        user:users(id, full_name, avatar_url)
      `
      )
      .eq("id", review_id)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { error: "리뷰를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ review });
  } catch (error) {
    // Handle review fetch API error silently

    return NextResponse.json(
      {
        error: "서버 오류가 발생했습니다.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
