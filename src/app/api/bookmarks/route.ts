import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 북마크 목록 조회
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get("tool_id");

    if (toolId) {
      // 특정 도구의 북마크 상태 확인
      const { data, error } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("tool_id", toolId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        console.error("Bookmark check error:", error);
        return NextResponse.json(
          { error: "북마크 상태를 확인하는 중 오류가 발생했습니다." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        isBookmarked: !!data,
      });
    } else {
      // 사용자의 모든 북마크 조회
      const { data, error } = await supabase
        .from("bookmarks")
        .select(
          `
          id,
          tool_id,
          created_at,
          tools!bookmarks_tool_id_fkey (
            id,
            name,
            description,
            url,
            logo_url,
            categories,
            bench_score,
            cost_index
          )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Bookmarks fetch error:", error);
        return NextResponse.json(
          { error: "북마크 목록을 가져오는 중 오류가 발생했습니다." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        bookmarks: data || [],
      });
    }
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 북마크 추가
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

    const { tool_id } = await request.json();

    if (!tool_id) {
      return NextResponse.json(
        { error: "도구 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("bookmarks")
      .insert({
        user_id: user.id,
        tool_id: tool_id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // unique violation
        return NextResponse.json(
          { error: "이미 북마크에 추가된 도구입니다." },
          { status: 409 }
        );
      }
      console.error("Bookmark insert error:", error);
      return NextResponse.json(
        { error: "북마크 추가 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "북마크에 추가되었습니다.",
      bookmark: data,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 북마크 제거
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
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("tool_id", tool_id);

    if (error) {
      console.error("Bookmark delete error:", error);
      return NextResponse.json(
        { error: "북마크 제거 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "북마크에서 제거되었습니다.",
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
