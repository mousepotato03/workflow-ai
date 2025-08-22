import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Get reviews
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get("tool_id");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!toolId) {
      return NextResponse.json(
        { error: "Tool ID is required." },
        { status: 400 }
      );
    }

    // Get reviews list
    const { data: reviews, error } = await supabase
      .from("reviews")
      .select(`
        id,
        rating,
        comment,
        created_at,
        user_id,
        tool_id
      `)
      .eq("tool_id", toolId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Reviews fetch error:", error);
      return NextResponse.json(
        { error: "An error occurred while fetching reviews." },
        { status: 500 }
      );
    }

    // Get average rating and review count
    const { data: ratingData, error: ratingError } = await supabase
      .from("tool_ratings")
      .select("review_count, average_rating")
      .eq("tool_id", toolId)
      .single();

    // Check if user has already rated this tool
    const { data: { user } } = await supabase.auth.getUser();
    let userRating = null;
    if (user) {
      const { data: userReview } = await supabase
        .from("reviews")
        .select("rating")
        .eq("tool_id", toolId)
        .eq("user_id", user.id)
        .single();
      userRating = userReview?.rating || null;
    }

    return NextResponse.json({
      reviews: reviews || [],
      totalRating: ratingData?.average_rating || 0,
      reviewCount: ratingData?.review_count || 0,
      userRating,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "A server error occurred." },
      { status: 500 }
    );
  }
}

// Write/edit review
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { tool_id, rating, comment } = await request.json();

    if (!tool_id || !rating) {
      return NextResponse.json(
        { error: "Tool ID and rating are required." },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5." },
        { status: 400 }
      );
    }

    // Use upsert to update existing review or create new one
    const { data, error } = await supabase
      .from("reviews")
      .upsert({
        user_id: user.id,
        tool_id: tool_id,
        rating: rating,
        comment: comment || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,tool_id"
      })
      .select()
      .single();

    if (error) {
      console.error("Review upsert error:", error);
      return NextResponse.json(
        { error: "An error occurred while saving the review." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Review saved successfully.",
      review: data,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "A server error occurred." },
      { status: 500 }
    );
  }
}

// Delete review
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check user authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { tool_id } = await request.json();

    if (!tool_id) {
      return NextResponse.json(
        { error: "Tool ID is required." },
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
        { error: "An error occurred while deleting the review." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Review deleted successfully.",
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "A server error occurred." },
      { status: 500 }
    );
  }
}