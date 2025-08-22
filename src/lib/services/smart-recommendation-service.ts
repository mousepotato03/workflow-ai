import { createClient } from "@supabase/supabase-js";
import { getEnvVar } from "@/lib/config/env-validation";
import { getRelevantTools } from "@/lib/supabase/vector-store";
import { logger } from "@/lib/logger/structured-logger";
import { Document } from "@langchain/core/documents";

// Initialize Supabase client
const supabase = createClient(
  getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
  getEnvVar("SUPABASE_SERVICE_ROLE_KEY")
);

export interface SmartRecommendationResult {
  taskId: string;
  taskName: string;
  toolId: string | null;
  toolName: string | null;
  reason: string;
  confidenceScore: number;
  finalScore: number;
  similarity: number;
  qualityScore: number;
  taskType: TaskType;
  searchDuration: number;
  rerankingDuration: number;
}

export enum TaskType {
  CODING = "coding",
  MATH = "math", 
  ANALYSIS = "analysis",
  GENERAL = "general",
  DESIGN = "design",
  WRITING = "writing",
  COMMUNICATION = "communication"
}

interface ToolCandidate {
  id: string;
  name: string;
  similarity: number;
  scores: any;
  url?: string;
  logo_url?: string;
}

interface QualityMetrics {
  benchmarks?: {
    HumanEval?: number;
    SWE_Bench?: number;
    MATH?: number;
    GPQA?: number;
    [key: string]: number | undefined;
  };
  user_rating?: {
    G2?: number;
    Capterra?: number;
    TrustPilot?: number;
    [key: string]: number | undefined;
  };
  performance_score?: number;
  reliability_score?: number;
}

/**
 * 2단계 Search-then-Rerank 추천 엔진의 핵심 클래스
 */
export class SmartRecommendationEngine {
  private readonly SIMILARITY_WEIGHT = 0.6;
  private readonly QUALITY_WEIGHT = 0.4;
  private readonly CANDIDATE_COUNT = 10;

  /**
   * 서브태스크 유형을 자동으로 감지
   */
  detectTaskType(taskName: string): TaskType {
    const taskLower = taskName.toLowerCase();
    
    // 코딩 관련 키워드
    const codingKeywords = [
      'code', 'coding', 'programming', 'develop', 'implement', 'function', 
      'api', 'algorithm', 'debug', 'test', 'deploy'
    ];
    
    // 수학/분석 관련 키워드
    const mathKeywords = [
      'math', 'mathematical', 'calculate', 'analysis', 'analyze', 'statistics',
      'data analysis', 'statistical', 'computation'
    ];
    
    // 디자인 관련 키워드
    const designKeywords = [
      'design', 'visual', 'graphic', 'ui', 'ux', 'interface', 'prototype',
      'mockup', 'wireframe'
    ];
    
    // 작성 관련 키워드
    const writingKeywords = [
      'write', 'writing', 'content', 'document', 'article', 'blog', 'copy',
      'text', 'essay'
    ];
    
    // 커뮤니케이션 관련 키워드
    const communicationKeywords = [
      'communication', 'collaborate', 'team', 'meeting', 'chat', 'message',
      'email', 'notification'
    ];

    if (codingKeywords.some(keyword => taskLower.includes(keyword))) {
      return TaskType.CODING;
    }
    
    if (mathKeywords.some(keyword => taskLower.includes(keyword))) {
      return TaskType.MATH;
    }
    
    if (designKeywords.some(keyword => taskLower.includes(keyword))) {
      return TaskType.DESIGN;
    }
    
    if (writingKeywords.some(keyword => taskLower.includes(keyword))) {
      return TaskType.WRITING;
    }
    
    if (communicationKeywords.some(keyword => taskLower.includes(keyword))) {
      return TaskType.COMMUNICATION;
    }
    
    return TaskType.GENERAL;
  }

  /**
   * scores JSONB에서 품질 점수를 추출하고 정규화
   */
  extractQualityScore(scores: any, taskType: TaskType): number {
    if (!scores) return 0.5; // 기본값

    const metrics: QualityMetrics = scores;
    
    try {
      // 태스크 유형별 적응형 품질 평가
      switch (taskType) {
        case TaskType.CODING:
          // 코딩: benchmarks > user_rating 순으로 우선순위
          if (metrics.benchmarks?.HumanEval) {
            return this.normalizeScore(metrics.benchmarks.HumanEval, 0, 100);
          }
          if (metrics.benchmarks?.SWE_Bench) {
            return this.normalizeScore(metrics.benchmarks.SWE_Bench, 0, 100);
          }
          if (metrics.user_rating?.G2) {
            return this.normalizeScore(metrics.user_rating.G2, 1, 5);
          }
          break;
          
        case TaskType.MATH:
        case TaskType.ANALYSIS:
          // 수학/분석: MATH, GPQA > user_rating
          if (metrics.benchmarks?.MATH) {
            return this.normalizeScore(metrics.benchmarks.MATH, 0, 100);
          }
          if (metrics.benchmarks?.GPQA) {
            return this.normalizeScore(metrics.benchmarks.GPQA, 0, 100);
          }
          if (metrics.user_rating?.G2) {
            return this.normalizeScore(metrics.user_rating.G2, 1, 5);
          }
          break;
          
        default:
          // 일반: user_rating을 주로 사용
          if (metrics.user_rating?.G2) {
            return this.normalizeScore(metrics.user_rating.G2, 1, 5);
          }
          if (metrics.user_rating?.Capterra) {
            return this.normalizeScore(metrics.user_rating.Capterra, 1, 5);
          }
          if (metrics.user_rating?.TrustPilot) {
            return this.normalizeScore(metrics.user_rating.TrustPilot, 1, 5);
          }
      }
      
      // 폴백: 사용 가능한 첫 번째 점수 사용
      if (metrics.user_rating?.G2) {
        return this.normalizeScore(metrics.user_rating.G2, 1, 5);
      }
      if (metrics.performance_score) {
        return this.normalizeScore(metrics.performance_score, 0, 100);
      }
      
    } catch (error) {
      logger.warn("Quality score extraction failed", { scores, taskType, error });
    }
    
    return 0.5; // 기본값
  }

  /**
   * 점수를 0-1 범위로 정규화
   */
  private normalizeScore(score: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (score - min) / (max - min)));
  }


  /**
   * 1단계: 벡터 검색으로 후보군 선정 (10개)
   */
  async searchCandidates(
    taskName: string,
    userPreferences?: any
  ): Promise<{ candidates: ToolCandidate[], searchDuration: number }> {
    const startTime = Date.now();
    
    try {
      logger.info("도구 매칭 1단계: 벡터 검색 시작", {
        taskName,
        candidateCount: this.CANDIDATE_COUNT,
        userPreferences: userPreferences ? Object.keys(userPreferences) : null
      });

      // 벡터 검색으로 후보군 확보
      const relevantTools = await getRelevantTools(
        taskName,
        this.CANDIDATE_COUNT,
        userPreferences
      );

      logger.info("벡터 검색 완료", {
        taskName,
        foundToolsCount: relevantTools.length,
        searchTime: Date.now() - startTime
      });

      if (relevantTools.length === 0) {
        logger.warn("벡터 검색 결과 없음", { taskName });
        return { candidates: [], searchDuration: Date.now() - startTime };
      }

      // 후보 도구의 메타데이터와 scores 가져오기
      const candidateIds = relevantTools
        .map((doc) => doc.metadata.id)
        .filter(Boolean);

      logger.debug("후보 도구 메타데이터 조회 시작", {
        taskName,
        candidateIds,
        candidateCount: candidateIds.length
      });

      const { data: toolsData } = await supabase
        .from("tools")
        .select("id, name, scores, url, logo_url")
        .in("id", candidateIds);

      logger.debug("후보 도구 메타데이터 조회 완료", {
        taskName,
        retrievedDataCount: toolsData?.length || 0
      });

      const candidates: ToolCandidate[] = relevantTools.map((doc, index) => {
        const toolData = toolsData?.find((tool: any) => tool.id === doc.metadata.id);
        
        // 유사도 점수 추출 (메타데이터에 있거나 순서 기반으로 계산)
        const similarity = doc.metadata.hybrid_score || 
                          doc.metadata.vector_similarity ||
                          doc.metadata.score ||
                          (1 - (index / this.CANDIDATE_COUNT)); // 순서 기반 유사도

        const candidate = {
          id: doc.metadata.id,
          name: doc.metadata.name,
          similarity: Math.max(0, Math.min(1, similarity)),
          scores: toolData?.scores || {},
          url: toolData?.url,
          logo_url: toolData?.logo_url
        };

        logger.debug("후보 도구 정보", {
          taskName,
          toolId: candidate.id,
          toolName: candidate.name,
          similarity: candidate.similarity,
          hasScores: Object.keys(candidate.scores).length > 0,
          rank: index + 1
        });

        return candidate;
      });

      logger.info("도구 매칭 1단계 완료", {
        taskName,
        candidatesCount: candidates.length,
        searchDuration: Date.now() - startTime,
        topCandidates: candidates.slice(0, 3).map(c => ({
          name: c.name,
          similarity: c.similarity
        }))
      });

      return { 
        candidates, 
        searchDuration: Date.now() - startTime 
      };

    } catch (error) {
      logger.error("도구 매칭 1단계 실패", { 
        taskName, 
        error: error instanceof Error ? error.message : String(error),
        searchDuration: Date.now() - startTime 
      });
      return { candidates: [], searchDuration: Date.now() - startTime };
    }
  }

  /**
   * 2단계: 재랭킹 및 최종 선정
   */
  async rerankCandidates(
    candidates: ToolCandidate[],
    taskType: TaskType
  ): Promise<{ rankedCandidates: (ToolCandidate & { finalScore: number, qualityScore: number })[], rerankingDuration: number }> {
    const startTime = Date.now();
    
    try {
      logger.info("도구 매칭 2단계: 재랭킹 시작", {
        candidatesCount: candidates.length,
        taskType,
        similarityWeight: this.SIMILARITY_WEIGHT,
        qualityWeight: this.QUALITY_WEIGHT
      });

      const rankedCandidates = candidates.map((candidate, index) => {
        const qualityScore = this.extractQualityScore(candidate.scores, taskType);
        const finalScore = (candidate.similarity * this.SIMILARITY_WEIGHT) + 
                          (qualityScore * this.QUALITY_WEIGHT);
        
        const rankedCandidate = {
          ...candidate,
          qualityScore,
          finalScore
        };

        logger.debug("후보 도구 재랭킹 점수", {
          toolName: candidate.name,
          taskType,
          similarity: candidate.similarity,
          qualityScore,
          finalScore,
          scoringDetail: {
            similarityContribution: candidate.similarity * this.SIMILARITY_WEIGHT,
            qualityContribution: qualityScore * this.QUALITY_WEIGHT
          },
          originalRank: index + 1
        });

        return rankedCandidate;
      });

      // 최종 점수로 정렬
      rankedCandidates.sort((a, b) => b.finalScore - a.finalScore);
      
      logger.info("도구 매칭 2단계 완료", {
        taskType,
        candidatesCount: rankedCandidates.length,
        rerankingDuration: Date.now() - startTime,
        finalRankings: rankedCandidates.slice(0, 5).map((c, idx) => ({
          rank: idx + 1,
          name: c.name,
          finalScore: c.finalScore,
          similarity: c.similarity,
          qualityScore: c.qualityScore
        })),
        bestTool: rankedCandidates[0] ? {
          name: rankedCandidates[0].name,
          finalScore: rankedCandidates[0].finalScore
        } : null
      });
      
      return {
        rankedCandidates,
        rerankingDuration: Date.now() - startTime
      };

    } catch (error) {
      logger.error("도구 매칭 2단계 실패", { 
        candidates: candidates.length, 
        taskType, 
        error: error instanceof Error ? error.message : String(error),
        rerankingDuration: Date.now() - startTime 
      });
      return { 
        rankedCandidates: candidates.map(c => ({ ...c, finalScore: 0, qualityScore: 0 })), 
        rerankingDuration: Date.now() - startTime 
      };
    }
  }

  /**
   * 메인 추천 함수: 2단계 Search-then-Rerank 실행
   */
  async getSmartRecommendation(
    taskName: string,
    userPreferences?: any,
    userContext?: { userId?: string; sessionId: string; language: string }
  ): Promise<SmartRecommendationResult> {
    const taskId = crypto.randomUUID();
    const overallStartTime = Date.now();
    
    try {
      // 서브태스크 유형 감지
      const taskType = this.detectTaskType(taskName);
      
      logger.info("스마트 도구 추천 시작", {
        taskId,
        taskName,
        taskType,
        userPreferences: userPreferences ? Object.keys(userPreferences) : null,
        ...userContext
      });

      // 1단계: 벡터 검색으로 후보군 선정
      const { candidates, searchDuration } = await this.searchCandidates(
        taskName, 
        userPreferences
      );

      if (candidates.length === 0) {
        logger.warn("도구 매칭 실패: 후보 도구 없음", {
          taskId,
          taskName,
          taskType,
          totalDuration: Date.now() - overallStartTime
        });

        return {
          taskId,
          taskName,
          toolId: null,
          toolName: null,
          reason: "해당 작업에 적합한 도구를 찾을 수 없습니다.",
          confidenceScore: 0,
          finalScore: 0,
          similarity: 0,
          qualityScore: 0,
          taskType,
          searchDuration,
          rerankingDuration: 0
        };
      }

      // 2단계: 재랭킹 및 최종 선정
      const { rankedCandidates, rerankingDuration } = await this.rerankCandidates(
        candidates,
        taskType
      );

      const bestTool = rankedCandidates[0];
      
      const reason = `Final Score: ${bestTool.finalScore.toFixed(3)} ` +
                    `(Similarity: ${bestTool.similarity.toFixed(3)} × ${this.SIMILARITY_WEIGHT} + ` +
                    `Quality: ${bestTool.qualityScore.toFixed(3)} × ${this.QUALITY_WEIGHT}) ` +
                    `| Task Type: ${taskType}`;

      const totalDuration = Date.now() - overallStartTime;

      logger.info("스마트 도구 추천 완료", {
        taskId,
        taskName,
        taskType,
        recommendedTool: {
          id: bestTool.id,
          name: bestTool.name,
          finalScore: bestTool.finalScore,
          similarity: bestTool.similarity,
          qualityScore: bestTool.qualityScore
        },
        performance: {
          totalDuration,
          searchDuration,
          rerankingDuration,
          candidatesEvaluated: candidates.length
        },
        scoringBreakdown: {
          similarityWeight: this.SIMILARITY_WEIGHT,
          qualityWeight: this.QUALITY_WEIGHT,
          similarityContribution: bestTool.similarity * this.SIMILARITY_WEIGHT,
          qualityContribution: bestTool.qualityScore * this.QUALITY_WEIGHT
        },
        ...userContext
      });

      return {
        taskId,
        taskName,
        toolId: bestTool.id,
        toolName: bestTool.name,
        reason,
        confidenceScore: bestTool.finalScore,
        finalScore: bestTool.finalScore,
        similarity: bestTool.similarity,
        qualityScore: bestTool.qualityScore,
        taskType,
        searchDuration,
        rerankingDuration
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const totalDuration = Date.now() - overallStartTime;
      
      logger.error("스마트 도구 추천 실패", {
        taskId,
        taskName,
        error: errorMessage,
        totalDuration,
        ...userContext
      });

      return {
        taskId,
        taskName,
        toolId: null,
        toolName: null,
        reason: `추천 과정에서 오류가 발생했습니다: ${errorMessage}`,
        confidenceScore: 0,
        finalScore: 0,
        similarity: 0,
        qualityScore: 0,
        taskType: TaskType.GENERAL,
        searchDuration: totalDuration,
        rerankingDuration: 0
      };
    }
  }

  /**
   * 여러 태스크에 대한 병렬 처리 (기존 processTasksInParallel과 호환)
   */
  async processTasksInParallel(
    tasks: Array<{ id: string; name: string }>,
    userPreferences?: any,
    userContext?: { userId?: string; sessionId: string; language: string },
    workflowId?: string
  ): Promise<SmartRecommendationResult[]> {
    const taskPromises = tasks.map(async (task) => {
      const result = await this.getSmartRecommendation(
        task.name,
        userPreferences,
        userContext
      );
      
      // 기존 TaskRecommendation 형식과 호환되도록 taskId 변경
      return {
        ...result,
        taskId: task.id
      };
    });

    const results = await Promise.all(taskPromises);
    
    logger.info("Smart batch recommendation completed", {
      workflowId,
      totalTasks: tasks.length,
      successfulRecommendations: results.filter(r => r.toolId !== null).length,
      ...userContext
    });

    return results;
  }
}

// 싱글톤 인스턴스 생성
export const smartRecommendationEngine = new SmartRecommendationEngine();