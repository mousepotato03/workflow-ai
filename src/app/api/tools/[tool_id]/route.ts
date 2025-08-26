import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tool_id: string }> }
) {
  try {
    const { tool_id } = await params;
    const supabase = await createClient();

    // Get tool data from database
    const { data: tool, error } = await supabase
      .from("tools")
      .select(
        `
        id,
        name,
        description,
        url,
        logo_url,
        categories,
        domains,
        scores,
        is_active,
        created_at
      `
      )
      .eq("id", tool_id)
      .eq("is_active", true)
      .single();

    if (error) {
      console.error("Tool fetch error:", error);
      return NextResponse.json(
        { error: "Tool not found" },
        { status: 404 }
      );
    }

    if (!tool) {
      return NextResponse.json(
        { error: "Tool not found" },
        { status: 404 }
      );
    }

    // Get rating information for this tool
    const { data: ratings } = await supabase
      .from("reviews")
      .select("rating")
      .eq("tool_id", tool_id);

    let ratingInfo = {
      review_count: 0,
      average_rating: 0,
    };

    if (ratings && ratings.length > 0) {
      const totalRating = ratings.reduce((sum, review) => sum + review.rating, 0);
      ratingInfo = {
        review_count: ratings.length,
        average_rating: Math.round((totalRating / ratings.length) * 100) / 100,
      };
    }

    // Format tool data with pricing and rating information
    const pricingModel = (tool as any)?.scores?.pricing_model as
      | "free"
      | "paid"
      | "freemium"
      | undefined;

    const toolWithDetails = {
      ...tool,
      pricing: pricingModel
        ? pricingModel === "paid"
          ? "Paid"
          : "Free"
        : "Free",
      rating: ratingInfo.average_rating,
      reviewCount: ratingInfo.review_count,
      likes: Math.floor(Math.random() * 1000) + 100, // Temporary like count (to be implemented later)
    };

    return NextResponse.json(toolWithDetails);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "A server error occurred." },
      { status: 500 }
    );
  }
}