import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

interface ToolData {
  name: string;
  description: string;
  url: string;
  logo_url: string;
  categories: string;
  domains: string;
  cost_index: string;
  bench_score: string;
  embedding_text: string;
}

async function importToolsData() {
  try {
    console.log('🚀 도구 데이터 가져오기 시작...');

    // 1. CSV 파일 읽기
    const csvFilePath = path.resolve(__dirname, '../supabase/tools-data/20250811000002_tools_data.csv');
    
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV 파일을 찾을 수 없습니다: ${csvFilePath}`);
    }

    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    const records: ToolData[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`📊 총 ${records.length}개의 도구 데이터를 읽었습니다.`);

    let successCount = 0;
    let errorCount = 0;

    // 2. 각 레코드 처리
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        console.log(`\n⚙️  [${i + 1}/${records.length}] "${record.name}" 처리 중...`);

        // 임베딩 생성
        console.log('  🧠 임베딩 생성 중...');
        const embeddingResult = await embeddingModel.embedContent(record.embedding_text);
        const embedding = embeddingResult.embedding.values;

        // 카테고리와 도메인을 배열로 변환
        const categories = record.categories ? 
          record.categories.split(',').map(s => s.trim()).filter(s => s.length > 0) : 
          [];
        
        const domains = record.domains ? 
          record.domains.split(',').map(s => s.trim()).filter(s => s.length > 0) : 
          [];

        // Supabase에 데이터 삽입/업데이트
        console.log('  💾 데이터베이스에 저장 중...');
        const { error } = await supabase.from('tools').upsert({
          name: record.name,
          description: record.description,
          url: record.url,
          logo_url: record.logo_url,
          categories: categories,
          domains: domains,
          cost_index: parseFloat(record.cost_index) || 0,
          bench_score: parseFloat(record.bench_score) || 0,
          embedding_text: record.embedding_text,
          embedding: embedding,
          is_active: true,
        }, { 
          onConflict: 'name',
          ignoreDuplicates: false 
        });

        if (error) {
          throw error;
        }

        console.log(`  ✅ "${record.name}" 성공적으로 저장됨`);
        successCount++;

      } catch (error: any) {
        console.error(`  ❌ "${record.name}" 처리 중 오류 발생:`, error.message);
        errorCount++;
      }

      // API 속도 제한을 위한 지연
      if (i < records.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n📈 가져오기 완료!');
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    console.log(`📊 총합: ${records.length}개`);

    // 최종 통계 확인
    const { count, error: countError } = await supabase
      .from('tools')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('통계 조회 오류:', countError);
    } else {
      console.log(`\n🗄️  데이터베이스 총 도구 수: ${count}개`);
    }

  } catch (error: any) {
    console.error('❌ 가져오기 프로세스 오류:', error.message);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  importToolsData()
    .then(() => {
      console.log('\n🎉 모든 작업이 완료되었습니다!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 스크립트 실행 오류:', error);
      process.exit(1);
    });
}

export default importToolsData;