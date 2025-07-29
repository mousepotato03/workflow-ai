import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import {
  createTaskDecomposerChain,
  createToolRecommenderChain,
  formatToolsContext,
  parseToolRecommendation,
} from "@/lib/langchain/chains";
import { getRelevantTools } from "@/lib/supabase/vector-store";
import { WorkflowRequest, WorkflowResponse } from "@/types/workflow";

// Request validation schema
const workflowRequestSchema = z.object({
  goal: z
    .string()
    .min(10, "목표는 10자 이상 입력해주세요.")
    .max(200, "목표는 200자 이내로 입력해주세요."),
  language: z.string().min(2).max(10),
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body: WorkflowRequest = await request.json();
    const validatedData = workflowRequestSchema.parse(body);

    // Create workflow record
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .insert({
        goal: validatedData.goal,
        language: validatedData.language,
        status: "processing",
      })
      .select()
      .single();

    if (workflowError || !workflow) {
      throw new Error("워크플로우 생성 실패: " + workflowError?.message);
    }

    // Step 1: Decompose goal into tasks using LangChain
    const taskDecomposer = createTaskDecomposerChain();
    const taskResult = await taskDecomposer.invoke({
      goal: validatedData.goal,
      language: validatedData.language,
    });

    if (!taskResult.tasks || !Array.isArray(taskResult.tasks)) {
      throw new Error(
        "작업 분해 실패: 올바른 형식의 작업 목록을 생성할 수 없습니다."
      );
    }

    // Insert tasks into database
    const tasksToInsert = taskResult.tasks.map(
      (taskName: string, index: number) => ({
        workflow_id: workflow.id,
        name: taskName,
        order_index: index + 1,
        description: `${validatedData.goal}를 위한 ${index + 1}번째 작업`,
      })
    );

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .insert(tasksToInsert)
      .select();

    if (tasksError || !tasks) {
      throw new Error("작업 저장 실패: " + tasksError?.message);
    }

    // Step 2: Get tool recommendations for each task
    const toolRecommender = createToolRecommenderChain();
    const recommendations = [];

    for (const task of tasks) {
      try {
        // Retrieve similar tools using enhanced search with fallback
        const relevantTools = await getRelevantTools(task.name, 3);

        if (relevantTools.length === 0) {
          // No tools found, create recommendation with no tool
          const { error: recError } = await supabase
            .from("recommendations")
            .insert({
              task_id: task.id,
              tool_id: null,
              reason: "해당 작업에 적합한 도구를 찾을 수 없습니다.",
              confidence_score: 0,
            });

          if (recError) {
            // Handle recommendation save error silently
          }

          recommendations.push({
            id: task.id,
            name: task.name,
            order: task.order_index,
            recommendedTool: null,
            recommendationReason: "해당 작업에 적합한 도구를 찾을 수 없습니다.",
            confidence: 0,
          });
          continue;
        }

        // Format tools context for LLM
        const context = formatToolsContext(relevantTools);

        // Get recommendation from LLM
        const recommendationResult = await toolRecommender.invoke({
          task: task.name,
          context,
          language: validatedData.language,
        });

        const { toolName, reason } =
          parseToolRecommendation(recommendationResult);

        // Find the recommended tool in relevant tools
        let recommendedTool = null;
        let confidence = 0.5; // Default confidence

        if (toolName) {
          const matchedTool = relevantTools.find(
            (tool) =>
              tool.metadata.name.toLowerCase() === toolName.toLowerCase()
          );

          if (matchedTool) {
            recommendedTool = {
              id: matchedTool.metadata.id,
              name: matchedTool.metadata.name,
              logoUrl: matchedTool.metadata.logo_url || "",
              url: matchedTool.metadata.url || "",
            };
            confidence = 0.8; // Higher confidence when tool is found
          }
        }

        // Save recommendation to database
        const { error: recError } = await supabase
          .from("recommendations")
          .insert({
            task_id: task.id,
            tool_id: recommendedTool?.id || null,
            reason: reason || "추천 이유를 생성할 수 없습니다.",
            confidence_score: confidence,
          });

        if (recError) {
          // Handle recommendation save error silently
        }

        recommendations.push({
          id: task.id,
          name: task.name,
          order: task.order_index,
          recommendedTool,
          recommendationReason: reason || "추천 이유를 생성할 수 없습니다.",
          confidence,
        });
      } catch (error) {
        // Handle tool recommendation error silently

        // Save failed recommendation
        const { error: recError } = await supabase
          .from("recommendations")
          .insert({
            task_id: task.id,
            tool_id: null,
            reason: "도구 추천 중 오류가 발생했습니다.",
            confidence_score: 0,
          });

        if (recError) {
          // Handle failed recommendation save error silently
        }

        recommendations.push({
          id: task.id,
          name: task.name,
          order: task.order_index,
          recommendedTool: null,
          recommendationReason: "도구 추천 중 오류가 발생했습니다.",
          confidence: 0,
        });
      }
    }

    // Update workflow status to completed
    await supabase
      .from("workflows")
      .update({ status: "completed" })
      .eq("id", workflow.id);

    // Return response
    const response: WorkflowResponse = {
      workflowId: workflow.id,
      tasks: recommendations.sort((a, b) => a.order - b.order),
      status: "completed",
    };

    return NextResponse.json(response);
  } catch (error) {
    // Handle workflow API error silently

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 올바르지 않습니다.", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "서버 오류가 발생했습니다.",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
