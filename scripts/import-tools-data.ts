import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";

// Load environment variables from .env.local
config({ path: path.resolve(__dirname, "../.env.local") });

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

// New CSV schema (single CSV with scores JSON)
interface ToolCsvRow {
  name: string;
  description: string;
  url: string;
  logo_url?: string;
  categories?: string; // comma-separated
  domains?: string; // comma-separated
  scores?: string; // JSON string
  embedding_text: string; // English narrative for retrieval
}

type Scores = {
  benchmarks?: Record<string, number | null>;
  user_rating?: Record<string, number | null>;
  pricing_model: "free" | "paid" | "freemium";
  pricing_notes?: string | null;
  last_updated: string; // YYYY-MM-DD
  source_urls?: string[];
};

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseScores(jsonLike?: string): Scores {
  let parsed: any = {};
  if (jsonLike && jsonLike.trim().length > 0) {
    try {
      parsed = JSON.parse(jsonLike);
    } catch {
      parsed = {};
    }
  }
  const pricingModel =
    (parsed.pricing_model as Scores["pricing_model"]) || "freemium";
  return {
    benchmarks: parsed.benchmarks ?? undefined,
    user_rating: parsed.user_rating ?? undefined,
    pricing_model: pricingModel,
    pricing_notes: parsed.pricing_notes ?? undefined,
    last_updated: parsed.last_updated || today(),
    source_urls: Array.isArray(parsed.source_urls)
      ? parsed.source_urls.slice(0, 3)
      : undefined,
  };
}

function ensureArray(csvField?: string): string[] {
  if (!csvField) return [];
  return csvField
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function buildFaviconUrl(urlStr?: string, fallback?: string): string | null {
  try {
    if (!urlStr && fallback) urlStr = fallback;
    if (!urlStr) return null;
    const u = new URL(urlStr);
    return `https://www.google.com/s2/favicons?domain=${u.host}&sz=128`;
  } catch {
    return null;
  }
}

function deriveBenchScore(scores?: Scores): number | null {
  if (!scores || !scores.benchmarks) return null;
  const values = Object.values(scores.benchmarks)
    .map((v) => (typeof v === "number" ? v : null))
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 100) / 100;
}

function deriveCostIndex(scores?: Scores): number | null {
  if (!scores) return null;
  if (scores.pricing_model === "paid") return 1;
  return 0; // free/freemium treated as 0 for backward compatibility
}

// 새로운 다국어 구조 인터페이스
interface CoreToolData {
  name: string;
  url: string;
  logo_url: string;
  cost_index: string;
  bench_score: string;
  is_active: string;
}

interface ToolTranslationData {
  tool_name: string;
  language: string;
  description: string;
  categories: string;
  domains: string;
  embedding_text: string;
}

// 핵심 도구 정보 처리 함수
async function importCoreTools(): Promise<Map<string, string>> {
  console.log("\n🔧 Step 1: 핵심 도구 정보 가져오기...");

  const csvFilePath = path.resolve(
    __dirname,
    "../supabase/tools-data/tools.csv"
  );

  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`핵심 도구 CSV 파일을 찾을 수 없습니다: ${csvFilePath}`);
  }

  const fileContent = fs.readFileSync(csvFilePath, "utf-8");
  const records: CoreToolData[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`📊 총 ${records.length}개의 핵심 도구 데이터를 읽었습니다.`);

  const toolNameToIdMap = new Map<string, string>();
  let successCount = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    try {
      console.log(
        `\n⚙️  [${i + 1}/${records.length}] "${record.name}" 처리 중...`
      );

      // tools 테이블에 핵심 정보 삽입/업데이트
      const { data, error } = await supabase
        .from("tools")
        .upsert(
          {
            name: record.name,
            url: record.url || null,
            logo_url: record.logo_url || null,
            cost_index: parseFloat(record.cost_index) || null,
            bench_score: parseFloat(record.bench_score) || null,
            is_active: record.is_active?.toLowerCase() === "true" || true,
          },
          {
            onConflict: "name",
            ignoreDuplicates: false,
          }
        )
        .select("id, name");

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        toolNameToIdMap.set(record.name, data[0].id);
        console.log(
          `  ✅ "${record.name}" 성공적으로 저장됨 (ID: ${data[0].id})`
        );
        successCount++;
      }
    } catch (error: any) {
      console.error(`  ❌ "${record.name}" 처리 중 오류 발생:`, error.message);
    }
  }

  console.log(`\n📈 핵심 도구 가져오기 완료! 성공: ${successCount}개`);
  return toolNameToIdMap;
}

// 언어별 번역 데이터 처리 함수
async function importToolTranslations(
  toolNameToIdMap: Map<string, string>
): Promise<void> {
  console.log("\n🌐 Step 2: 한국어 번역 데이터 가져오기...");

  const csvFilePath = path.resolve(
    __dirname,
    "../supabase/tools-data/tool_translations_ko.csv"
  );

  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`번역 CSV 파일을 찾을 수 없습니다: ${csvFilePath}`);
  }

  const fileContent = fs.readFileSync(csvFilePath, "utf-8");
  const records: ToolTranslationData[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`📊 총 ${records.length}개의 번역 데이터를 읽었습니다.`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    try {
      console.log(
        `\n🌍 [${i + 1}/${records.length}] "${record.tool_name}" (${
          record.language
        }) 처리 중...`
      );

      // 해당 도구의 ID 찾기
      const toolId = toolNameToIdMap.get(record.tool_name);
      if (!toolId) {
        throw new Error(`도구 "${record.tool_name}"의 ID를 찾을 수 없습니다.`);
      }

      // 임베딩 생성
      console.log("  🧠 임베딩 생성 중...");
      const embeddingResult = await embeddingModel.embedContent(
        record.embedding_text
      );
      const embedding = embeddingResult.embedding.values;

      // 카테고리와 도메인을 배열로 변환
      const categories = record.categories
        ? record.categories
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];

      const domains = record.domains
        ? record.domains
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
        : [];

      // tool_translations 테이블에 데이터 삽입/업데이트
      console.log("  💾 번역 데이터베이스에 저장 중...");
      const { error } = await supabase.from("tool_translations").upsert(
        {
          tool_id: toolId,
          language: record.language,
          description: record.description,
          categories: categories,
          domains: domains,
          embedding_text: record.embedding_text,
          embedding: embedding,
        },
        {
          onConflict: "tool_id,language",
          ignoreDuplicates: false,
        }
      );

      if (error) {
        throw error;
      }

      console.log(
        `  ✅ "${record.tool_name}" (${record.language}) 성공적으로 저장됨`
      );
      successCount++;
    } catch (error: any) {
      console.error(
        `  ❌ "${record.tool_name}" (${record.language}) 처리 중 오류 발생:`,
        error.message
      );
      errorCount++;
    }

    // API 속도 제한을 위한 지연
    if (i < records.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`\n📈 번역 데이터 가져오기 완료!`);
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ 실패: ${errorCount}개`);
}

// 신규 CSV 스키마 기반 단일 임포트 함수
async function importToolsFromCsv(): Promise<void> {
  console.log("\n🔧 Import: tools.csv (new schema) ...");

  const csvFilePath = path.resolve(
    __dirname,
    "../supabase/tools-data/tools.csv"
  );

  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`CSV 파일을 찾을 수 없습니다: ${csvFilePath}`);
  }

  const fileContent = fs.readFileSync(csvFilePath, "utf-8");
  const records: ToolCsvRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`📊 총 ${records.length}개의 도구 데이터를 읽었습니다.`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    try {
      console.log(
        `\n⚙️  [${i + 1}/${records.length}] "${row.name}" 처리 중...`
      );

      const categories = ensureArray(row.categories);
      const domains = ensureArray(row.domains);
      const scores = parseScores(row.scores);
      const computedLogo = buildFaviconUrl(row.url, row.logo_url);
      const logoUrl =
        row.logo_url && row.logo_url.trim().length > 0
          ? row.logo_url
          : computedLogo;

      console.log("  🧠 임베딩 생성 중...");
      const embeddingResult = await embeddingModel.embedContent(
        row.embedding_text
      );
      const embedding = embeddingResult.embedding.values;

      const benchScore = deriveBenchScore(scores);
      const costIndex = deriveCostIndex(scores);

      const { error } = await supabase.from("tools").upsert(
        {
          name: row.name,
          description: row.description || null,
          url: row.url || null,
          logo_url: logoUrl,
          categories,
          domains,
          embedding_text: row.embedding_text,
          embedding,
          is_active: true,
          scores: scores as any,
          bench_score: benchScore,
          cost_index: costIndex,
        },
        { onConflict: "name", ignoreDuplicates: false }
      );

      if (error) throw error;
      console.log(`  ✅ "${row.name}" 저장 완료`);
      success++;
    } catch (e: any) {
      console.error(`  ❌ "${row.name}" 처리 실패:`, e?.message || e);
      failed++;
    }

    if (i < records.length - 1) {
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  console.log(`\n📈 Import 완료 — 성공: ${success}, 실패: ${failed}`);
}

// 메인 함수
async function importToolsData() {
  try {
    console.log("🚀 도구 데이터 가져오기 시작 (신규 CSV 스키마)...");
    console.log("📋 구조: tools (메타 + embedding + scores JSON)");

    await importToolsFromCsv();

    // 최종 통계 확인
    console.log("\n📊 최종 통계 확인...");
    const { count: toolsCount, error: toolsError } = await supabase
      .from("tools")
      .select("*", { count: "exact", head: true });

    if (toolsError) {
      console.error("통계 조회 오류:", toolsError);
    } else {
      console.log(`🗄️  도구 수: ${toolsCount}개`);
      console.log("🎯 임베딩 및 scores 저장 완료!");
    }
  } catch (error: any) {
    console.error("❌ 가져오기 프로세스 오류:", error.message);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  importToolsData()
    .then(() => {
      console.log("\n🎉 모든 작업이 완료되었습니다!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 스크립트 실행 오류:", error);
      process.exit(1);
    });
}

export default importToolsData;
