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

// CSV 스키마 인터페이스 - 실제 DB 컬럼에 맞춤
interface ToolCsvRow {
  name: string;
  description: string;
  url: string;
  logo_url?: string;
  categories?: string; // comma-separated
  domains?: string; // comma-separated
  scores?: string; // JSON string (scores 컬럼에 저장)
  embedding_text: string; // embedding_text 컬럼에 저장
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

function parseScores(jsonLike?: string): any {
  if (!jsonLike || jsonLike.trim().length === 0) {
    return {};
  }
  try {
    return JSON.parse(jsonLike);
  } catch {
    return {};
  }
}

// CSV 파일에서 도구 데이터 임포트 함수
async function importToolsFromCsv(csvFileName: string): Promise<void> {
  console.log(`\n🔧 Import: ${csvFileName} ...`);

  const csvFilePath = path.resolve(
    __dirname,
    `../supabase/tools-data/${csvFileName}`
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

      // 현재 데이터베이스 스키마에 맞게 데이터 구성
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
          scores,
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
async function importToolsData(csvFileName?: string) {
  try {
    // 기본 파일명 설정
    const defaultFileName = "20250822000001_tools_data.csv";
    const fileName = csvFileName || defaultFileName;

    console.log("🚀 도구 데이터 가져오기 시작...");
    console.log(`📋 파일: ${fileName}`);

    await importToolsFromCsv(fileName);

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
  // 명령행 인수에서 파일명 추출
  const args = process.argv.slice(2);
  const csvFileName = args[0]; // 첫 번째 인수를 파일명으로 사용

  if (csvFileName && (csvFileName === "--help" || csvFileName === "-h")) {
    console.log(`
📚 도구 데이터 가져오기 스크립트 사용법:

기본 사용법:
  npm run import-tools                    # 기본 파일 (20250822000001_tools_data.csv) 사용
  npm run import-tools [파일명.csv]       # 특정 CSV 파일 사용

예시:
  npm run import-tools
  npm run import-tools my_tools.csv
  npm run import-tools 20250822000001_tools_data.csv

도움말:
  npm run import-tools --help
  npm run import-tools -h
`);
    process.exit(0);
  }

  importToolsData(csvFileName)
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
