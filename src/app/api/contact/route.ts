import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
  inquiry_type: z
    .enum(["general", "partnership", "support", "feedback"])
    .default("general"),
  email: z.string().email().min(1).max(255),
  message: z.string().min(10).max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 요청 본문 검증
    const body = await request.json();
    const validatedData = contactSchema.parse(body);

    // 로그인된 사용자인지 확인 (선택사항)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // 사용자가 로그인되어 있다면 user_id를 포함, 아니면 null
    const user_id = !authError && user ? user.id : null;

    // contact 테이블에 데이터 삽입 (renamed)
    const { data: inquiry, error: insertError } = await supabase
      .from("contact")
      .insert({
        inquiry_type: validatedData.inquiry_type,
        email: validatedData.email,
        message: validatedData.message,
        user_id,
      })
      .select("id, inquiry_type, email, created_at")
      .single();

    if (insertError) {
      console.error("Insert inquiry error:", insertError);
      return NextResponse.json(
        { error: "Failed to submit inquiry" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Inquiry submitted successfully",
        data: inquiry,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Contact API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
