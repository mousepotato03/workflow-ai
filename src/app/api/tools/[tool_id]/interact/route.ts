import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const interactionSchema = z.object({
  interaction_type: z.number().int().min(-1).max(1), // -1: dislike, 1: like
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool_id: string }> }
) {
  try {
    const { tool_id } = await params;
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
    const validatedData = interactionSchema.parse(body);

    // tool_id가 유효한 UUID인지 확인
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tool_id
      )
    ) {
      return NextResponse.json(
        { error: "Invalid tool ID format" },
        { status: 400 }
      );
    }

    // 도구가 존재하는지 확인
    const { data: tool, error: toolError } = await supabase
      .from("tools")
      .select("id")
      .eq("id", tool_id)
      .eq("is_active", true)
      .single();

    if (toolError || !tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // 기존 상호작용 확인 및 업데이트/생성
    const { data: existingInteraction } = await supabase
      .from("tool_interactions")
      .select("id, interaction_type")
      .eq("user_id", user.id)
      .eq("tool_id", tool_id)
      .single();

    if (existingInteraction) {
      // 기존 상호작용이 있으면 업데이트
      const { data: updatedInteraction, error: updateError } = await supabase
        .from("tool_interactions")
        .update({
          interaction_type: validatedData.interaction_type,
        })
        .eq("id", existingInteraction.id)
        .select()
        .single();

      if (updateError) {
        console.error("Update interaction error:", updateError);
        return NextResponse.json(
          { error: "Failed to update interaction" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Interaction updated successfully",
        data: updatedInteraction,
      });
    } else {
      // 새로운 상호작용 생성
      const { data: newInteraction, error: insertError } = await supabase
        .from("tool_interactions")
        .insert({
          user_id: user.id,
          tool_id,
          interaction_type: validatedData.interaction_type,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Insert interaction error:", insertError);
        return NextResponse.json(
          { error: "Failed to create interaction" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Interaction created successfully",
        data: newInteraction,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Interaction API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
