import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const pricing = searchParams.get("pricing") || "";
    const filter = searchParams.get("filter") || "All Tools";
    const sort = searchParams.get("sort") || "Popular";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Check user authentication when bookmark filter is applied
    let userBookmarks: string[] = [];
    if (filter === "Bookmarked Only") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: "Login is required to use the bookmark filter." },
          { status: 401 }
        );
      }

      // Get user's bookmarks
      const { data: bookmarkData } = await supabase
        .from("bookmarks")
        .select("tool_id")
        .eq("user_id", user.id);

      userBookmarks = bookmarkData?.map((bookmark) => bookmark.tool_id) || [];

      // Return empty results if no bookmarks
      if (userBookmarks.length === 0) {
        return NextResponse.json({
          tools: [],
          categories: [],
          total: 0,
          hasMore: false,
        });
      }
    }

    // Base query configuration - ratings queried separately
    let query = supabase
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
      .eq("is_active", true);

    // Apply bookmark filter
    if (filter === "Bookmarked Only" && userBookmarks.length > 0) {
      query = query.in("id", userBookmarks);
    }

    // Apply search filter
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%,domains.cs.{${search}}`
      );
    }

    // Apply category filter
    if (category && category !== "All") {
      query = query.contains("categories", [category]);
    }

    // Apply sorting
    if (sort === "Latest") {
      query = query.order("created_at", { ascending: false });
    } else {
      // Popular: sort by created date as fallback (no scoring system)
      query = query.order("created_at", {
        ascending: false
      });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: tools, error } = await query;

    if (error) {
      console.error("Tools fetch error:", error);
      return NextResponse.json(
        { error: "An error occurred while fetching the tool list." },
        { status: 500 }
      );
    }

    // Query rating information separately
    const toolIds = tools?.map((tool) => tool.id) || [];
    let ratingsData: any[] = [];

    if (toolIds.length > 0) {
      const { data: ratings } = await supabase
        .from("reviews")
        .select("tool_id, rating")
        .in("tool_id", toolIds);

      if (ratings) {
        // Aggregate ratings by tool
        const ratingsByTool = ratings.reduce((acc: any, review: any) => {
          if (!acc[review.tool_id]) {
            acc[review.tool_id] = [];
          }
          acc[review.tool_id].push(review.rating);
          return acc;
        }, {});

        ratingsData = Object.entries(ratingsByTool).map(
          ([toolId, ratings]: [string, any]) => ({
            tool_id: toolId,
            review_count: ratings.length,
            average_rating:
              Math.round(
                (ratings.reduce(
                  (sum: number, rating: number) => sum + rating,
                  0
                ) /
                  ratings.length) *
                  100
              ) / 100,
          })
        );
      }
    }

    // Also return category list
    const { data: categoryData } = await supabase
      .from("tools")
      .select("categories")
      .eq("is_active", true);

    // Flatten all categories and remove duplicates
    const allCategories = new Set<string>();
    categoryData?.forEach((item) => {
      if (item.categories) {
        item.categories.forEach((cat: string) => allCategories.add(cat));
      }
    });

    const categories = ["All", ...Array.from(allCategories).sort()];

    // Map pricing info based on scores.pricing_model and use actual review data
    const toolsWithPricing = tools?.map((tool) => {
      const pricingModel = (tool as any)?.scores?.pricing_model as
        | "free"
        | "paid"
        | "freemium"
        | undefined;
      const ratingInfo = ratingsData.find((r) => r.tool_id === tool.id);
      return {
        ...tool,
        pricing: pricingModel
          ? pricingModel === "paid"
            ? "Paid"
            : "Free"
          : "Free",
        rating: ratingInfo?.average_rating || 0, // Use actual average rating
        reviewCount: ratingInfo?.review_count || 0, // Use actual review count
        likes: Math.floor(Math.random() * 1000) + 100, // Temporary like count (to be implemented later)
      };
    });

    return NextResponse.json({
      tools: toolsWithPricing,
      categories,
      total: tools?.length || 0,
      hasMore: tools?.length === limit,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "A server error occurred." },
      { status: 500 }
    );
  }
}
