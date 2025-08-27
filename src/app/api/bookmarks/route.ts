import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Get bookmarks list
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get("tool_id");

    if (toolId) {
      // Check bookmark status for specific tool
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
          { error: "An error occurred while checking bookmark status." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        isBookmarked: !!data,
      });
    } else {
      // Get all user bookmarks
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
            categories
          )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Bookmarks fetch error:", error);
        return NextResponse.json(
          { error: "An error occurred while fetching bookmarks." },
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
      { error: "A server error occurred." },
      { status: 500 }
    );
  }
}

// Add bookmark
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

    const { tool_id } = await request.json();

    if (!tool_id) {
      return NextResponse.json(
        { error: "Tool ID is required." },
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
          { error: "Tool is already bookmarked." },
          { status: 409 }
        );
      }
      console.error("Bookmark insert error:", error);
      return NextResponse.json(
        { error: "An error occurred while adding bookmark." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Added to bookmarks.",
      bookmark: data,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "A server error occurred." },
      { status: 500 }
    );
  }
}

// Remove bookmark
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
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("tool_id", tool_id);

    if (error) {
      console.error("Bookmark delete error:", error);
      return NextResponse.json(
        { error: "An error occurred while removing bookmark." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Removed from bookmarks.",
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "A server error occurred." },
      { status: 500 }
    );
  }
}