import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터 추출
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const pricing = searchParams.get("pricing") || "";
    const filter = searchParams.get("filter") || "All Tools";
    const sort = searchParams.get("sort") || "Popular";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // 북마크 필터가 적용된 경우 사용자 인증 확인
    let userBookmarks: string[] = [];
    if (filter === "Bookmarked Only") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: "북마크 필터를 사용하려면 로그인이 필요합니다." },
          { status: 401 }
        );
      }

      // 사용자의 북마크 가져오기
      const { data: bookmarkData } = await supabase
        .from("bookmarks")
        .select("tool_id")
        .eq("user_id", user.id);

      userBookmarks = bookmarkData?.map((bookmark) => bookmark.tool_id) || [];

      // 북마크가 없는 경우 빈 결과 반환
      if (userBookmarks.length === 0) {
        return NextResponse.json({
          tools: [],
          categories: [],
          total: 0,
          hasMore: false,
        });
      }
    }

    // 기본 쿼리 구성 - 별점 정보는 별도로 조회
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
        bench_score,
        cost_index,
        scores,
        is_active,
        created_at
      `
      )
      .eq("is_active", true);

    // 북마크 필터 적용
    if (filter === "Bookmarked Only" && userBookmarks.length > 0) {
      query = query.in("id", userBookmarks);
    }

    // 검색 필터 적용
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,description.ilike.%${search}%,domains.cs.{${search}}`
      );
    }

    // 카테고리 필터 적용
    if (category && category !== "All") {
      query = query.contains("categories", [category]);
    }

    // 정렬 적용
    if (sort === "Latest") {
      query = query.order("created_at", { ascending: false });
    } else {
      // Popular: bench_score 기준 정렬
      query = query.order("bench_score", {
        ascending: false,
        nullsFirst: false,
      });
    }

    // 페이지네이션 적용
    query = query.range(offset, offset + limit - 1);

    const { data: tools, error } = await query;

    if (error) {
      console.error("Tools fetch error:", error);
      return NextResponse.json(
        { error: "도구 목록을 가져오는 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    // 별도로 평점 정보 조회
    const toolIds = tools?.map((tool) => tool.id) || [];
    let ratingsData: any[] = [];

    if (toolIds.length > 0) {
      const { data: ratings } = await supabase
        .from("reviews")
        .select("tool_id, rating")
        .in("tool_id", toolIds);

      if (ratings) {
        // 도구별 평점 집계
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

    // 카테고리 목록도 함께 반환
    const { data: categoryData } = await supabase
      .from("tools")
      .select("categories")
      .eq("is_active", true);

    // 모든 카테고리를 평탄화하고 중복 제거
    const allCategories = new Set<string>();
    categoryData?.forEach((item) => {
      if (item.categories) {
        item.categories.forEach((cat: string) => allCategories.add(cat));
      }
    });

    const categories = ["All", ...Array.from(allCategories).sort()];

    // 가격 정보를 scores.pricing_model 또는 cost_index 기반으로 매핑하고 실제 리뷰 데이터 사용
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
          : tool.cost_index === null || tool.cost_index === 0
          ? "Free"
          : "Paid",
        rating: ratingInfo?.average_rating || 0, // 실제 평균 별점 사용
        reviewCount: ratingInfo?.review_count || 0, // 실제 리뷰 수 사용
        likes: Math.floor(Math.random() * 1000) + 100, // 임시 좋아요 수 (추후 구현 예정)
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
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
