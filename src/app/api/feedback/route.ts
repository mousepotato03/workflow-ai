import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { FeedbackRequest, FeedbackResponse } from "@/types/workflow";

// Request validation schema
const feedbackRequestSchema = z.object({
  workflowId: z.string().uuid("올바른 워크플로우 ID가 아닙니다."),
  rating: z
    .number()
    .int()
    .min(1, "평점은 1 이상이어야 합니다.")
    .max(5, "평점은 5 이하여야 합니다."),
  comment: z.string().optional(),
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body: FeedbackRequest = await request.json();
    const validatedData = feedbackRequestSchema.parse(body);

    // Check if workflow exists
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("id")
      .eq("id", validatedData.workflowId)
      .single();

    if (workflowError || !workflow) {
      return NextResponse.json(
        { success: false, message: "존재하지 않는 워크플로우입니다." },
        { status: 404 }
      );
    }

    // Check if feedback already exists for this workflow
    const { data: existingFeedback } = await supabase
      .from("feedback")
      .select("id")
      .eq("workflow_id", validatedData.workflowId)
      .single();

    if (existingFeedback) {
      // Update existing feedback
      const { error: updateError } = await supabase
        .from("feedback")
        .update({
          rating: validatedData.rating,
          comment: validatedData.comment || null,
          metadata: {
            updated_at: new Date().toISOString(),
          },
        })
        .eq("workflow_id", validatedData.workflowId);

      if (updateError) {
        throw new Error("피드백 업데이트 실패: " + updateError.message);
      }

      const response: FeedbackResponse = {
        success: true,
        message: "피드백이 성공적으로 업데이트되었습니다.",
      };

      return NextResponse.json(response);
    } else {
      // Create new feedback
      const { error: insertError } = await supabase.from("feedback").insert({
        workflow_id: validatedData.workflowId,
        rating: validatedData.rating,
        comment: validatedData.comment || null,
        metadata: {
          created_at: new Date().toISOString(),
        },
      });

      if (insertError) {
        throw new Error("피드백 저장 실패: " + insertError.message);
      }

      const response: FeedbackResponse = {
        success: true,
        message: "피드백이 성공적으로 저장되었습니다.",
      };

      return NextResponse.json(response);
    }
  } catch (error) {
    // Handle feedback API error silently

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: "입력 데이터가 올바르지 않습니다.",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "서버 오류가 발생했습니다.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
