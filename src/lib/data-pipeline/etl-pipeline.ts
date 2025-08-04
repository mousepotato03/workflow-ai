import { createClient } from '@supabase/supabase-js';
import { createEmbeddingStrategies } from '../embeddings/multi-embedding-strategy';
import { z } from 'zod';

// Data validation schemas
const ToolDataSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(10).max(1000),
  url: z.string().url().optional(),
  categories: z.array(z.string()).default([]),
  pricing_model: z.enum(['free', 'freemium', 'subscription', 'usage_based']).default('freemium'),
  target_audience: z.array(z.string()).default([]),
  use_cases: z.array(z.string()).default([]),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  api_available: z.boolean().default(false),
  difficulty_level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
});

const AIModelDataSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.string().min(1).max(50),
  model_type: z.string().min(1).max(50),
  context_window: z.number().positive().optional(),
  capabilities: z.array(z.string()).default([]),
  use_cases: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  best_for_tasks: z.array(z.string()).default([]),
});

const WorkflowPatternSchema = z.object({
  pattern_name: z.string().min(1).max(100),
  pattern_type: z.enum(['sequential', 'parallel', 'conditional', 'iterative']),
  industry: z.array(z.string()).default([]),
  complexity_level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  common_subtasks: z.array(z.string()).default([]),
  required_skills: z.array(z.string()).default([]),
  input_types: z.array(z.string()).default([]),
  output_types: z.array(z.string()).default([]),
});

export class DataPipeline {
  private supabase;
  private embeddings;

  constructor(config: {
    supabaseUrl: string;
    supabaseServiceKey: string;
    googleApiKey: string;
    openaiApiKey?: string;
  }) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    this.embeddings = createEmbeddingStrategies({
      googleApiKey: config.googleApiKey,
      openaiApiKey: config.openaiApiKey,
      enableHybridSearch: true,
    });
  }

  // Data extraction from various sources
  async extractToolData(sources: {
    productHunt?: boolean;
    g2?: boolean;
    customApis?: Array<{url: string, parser: (data: any) => any}>;
  }): Promise<any[]> {
    const extractedData: any[] = [];

    if (sources.productHunt) {
      try {
        // Product Hunt API integration
        const phData = await this.extractFromProductHunt();
        extractedData.push(...phData);
      } catch (error) {
        console.error('Product Hunt extraction failed:', error);
      }
    }

    if (sources.g2) {
      try {
        // G2 data extraction (would need API access or scraping)
        const g2Data = await this.extractFromG2();
        extractedData.push(...g2Data);
      } catch (error) {
        console.error('G2 extraction failed:', error);
      }
    }

    if (sources.customApis) {
      for (const api of sources.customApis) {
        try {
          const response = await fetch(api.url);
          const rawData = await response.json();
          const parsedData = api.parser(rawData);
          extractedData.push(...parsedData);
        } catch (error) {
          console.error(`Custom API ${api.url} extraction failed:`, error);
        }
      }
    }

    return extractedData;
  }

  private async extractFromProductHunt(): Promise<any[]> {
    // Mock implementation - would integrate with Product Hunt API
    console.log('Extracting from Product Hunt API...');
    return [];
  }

  private async extractFromG2(): Promise<any[]> {
    // Mock implementation - would integrate with G2 API or scraping
    console.log('Extracting from G2...');
    return [];
  }

  // Data transformation and validation
  async transformToolData(rawData: any[]): Promise<z.infer<typeof ToolDataSchema>[]> {
    const transformedData: z.infer<typeof ToolDataSchema>[] = [];

    for (const item of rawData) {
      try {
        // Clean and normalize data
        const cleaned = this.cleanToolData(item);
        
        // Validate against schema
        const validated = ToolDataSchema.parse(cleaned);
        
        // Additional business logic transformations
        const enhanced = await this.enhanceToolData(validated);
        
        transformedData.push(enhanced);
      } catch (error) {
        console.error(`Failed to transform tool data:`, error);
        console.error('Raw item:', JSON.stringify(item, null, 2));
      }
    }

    return transformedData;
  }

  private cleanToolData(rawItem: any): any {
    return {
      name: this.sanitizeString(rawItem.name || rawItem.title || ''),
      description: this.sanitizeString(rawItem.description || rawItem.tagline || ''),
      url: this.sanitizeUrl(rawItem.url || rawItem.website || ''),
      categories: this.sanitizeArray(rawItem.categories || rawItem.tags || []),
      pricing_model: this.inferPricingModel(rawItem),
      target_audience: this.extractTargetAudience(rawItem),
      use_cases: this.extractUseCases(rawItem),
      pros: this.sanitizeArray(rawItem.pros || []),
      cons: this.sanitizeArray(rawItem.cons || []),
      api_available: Boolean(rawItem.api_available || rawItem.has_api),
      difficulty_level: this.inferDifficultyLevel(rawItem),
    };
  }

  private sanitizeString(str: string): string {
    return str.trim().replace(/\s+/g, ' ').substring(0, 1000);
  }

  private sanitizeUrl(url: string): string | undefined {
    try {
      const parsed = new URL(url);
      return parsed.toString();
    } catch {
      return undefined;
    }
  }

  private sanitizeArray(arr: any[]): string[] {
    return Array.isArray(arr) 
      ? arr.filter(item => typeof item === 'string' && item.length > 0)
           .map(item => item.trim())
           .slice(0, 20) // Limit array size
      : [];
  }

  private inferPricingModel(item: any): 'free' | 'freemium' | 'subscription' | 'usage_based' {
    const text = JSON.stringify(item).toLowerCase();
    
    if (text.includes('free') && text.includes('premium')) return 'freemium';
    if (text.includes('subscription') || text.includes('monthly')) return 'subscription';
    if (text.includes('usage') || text.includes('per request')) return 'usage_based';
    if (text.includes('free')) return 'free';
    
    return 'freemium';
  }

  private extractTargetAudience(item: any): string[] {
    const text = JSON.stringify(item).toLowerCase();
    const audiences: string[] = [];
    
    const audienceKeywords = {
      'developers': ['developer', 'programmer', 'coder', 'engineer'],
      'designers': ['designer', 'creative', 'ui/ux'],
      'marketers': ['marketer', 'marketing', 'growth'],
      'analysts': ['analyst', 'data scientist', 'researcher'],
      'managers': ['manager', 'project manager', 'team lead'],
      'students': ['student', 'learner', 'education'],
      'entrepreneurs': ['startup', 'entrepreneur', 'founder'],
    };

    for (const [audience, keywords] of Object.entries(audienceKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        audiences.push(audience);
      }
    }

    return audiences;
  }

  private extractUseCases(item: any): string[] {
    const text = JSON.stringify(item).toLowerCase();
    const useCases: string[] = [];
    
    const useCaseKeywords = {
      'content_creation': ['content', 'writing', 'blog', 'article'],
      'data_analysis': ['data', 'analytics', 'dashboard', 'chart'],
      'automation': ['automate', 'workflow', 'integration'],
      'collaboration': ['collaborate', 'team', 'share', 'communication'],
      'project_management': ['project', 'task', 'planning', 'organize'],
      'design': ['design', 'prototype', 'mockup', 'visual'],
      'development': ['code', 'api', 'development', 'programming'],
    };

    for (const [useCase, keywords] of Object.entries(useCaseKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        useCases.push(useCase);
      }
    }

    return useCases;
  }

  private inferDifficultyLevel(item: any): 'beginner' | 'intermediate' | 'advanced' {
    const text = JSON.stringify(item).toLowerCase();
    
    if (text.includes('enterprise') || text.includes('advanced') || text.includes('expert')) {
      return 'advanced';
    }
    if (text.includes('simple') || text.includes('easy') || text.includes('beginner')) {
      return 'beginner';
    }
    
    return 'intermediate';
  }

  private async enhanceToolData(tool: z.infer<typeof ToolDataSchema>): Promise<z.infer<typeof ToolDataSchema>> {
    // Add any additional enhancements
    // For example, fetch additional metadata, classify categories, etc.
    return tool;
  }

  // Load data into vector database
  async loadToolsToDatabase(tools: z.infer<typeof ToolDataSchema>[]): Promise<{
    successful: number;
    failed: number;
    errors: Array<{tool: string, error: string}>;
  }> {
    const results = { successful: 0, failed: 0, errors: [] as Array<{tool: string, error: string}> };

    // Process in batches to avoid overwhelming the embedding API
    const batchSize = 10;
    for (let i = 0; i < tools.length; i += batchSize) {
      const batch = tools.slice(i, i + batchSize);
      
      try {
        await this.processBatch(batch, results);
      } catch (error) {
        console.error(`Batch ${i}-${i + batchSize} failed:`, error);
        results.failed += batch.length;
        batch.forEach(tool => {
          results.errors.push({ tool: tool.name, error: String(error) });
        });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  private async processBatch(
    batch: z.infer<typeof ToolDataSchema>[], 
    results: { successful: number; failed: number; errors: Array<{tool: string, error: string}> }
  ): Promise<void> {
    const promises = batch.map(async (tool) => {
      try {
        // Generate embedding
        const { embeddingText, embedding } = await this.embeddings.toolEmbedder.embedToolData(tool);
        
        // Insert into database
        const { error } = await this.supabase
          .from('tools')
          .upsert({
            name: tool.name,
            description: tool.description,
            url: tool.url,
            categories: tool.categories,
            pricing_model: tool.pricing_model,
            target_audience: tool.target_audience,
            use_cases: tool.use_cases,
            pros: tool.pros,
            cons: tool.cons,
            api_available: tool.api_available,
            difficulty_level: tool.difficulty_level,
            embedding_text: embeddingText,
            embedding: embedding,
            is_active: true,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'name',
            ignoreDuplicates: false
          });

        if (error) throw error;
        
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({ tool: tool.name, error: String(error) });
        console.error(`Failed to process tool ${tool.name}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  // Data quality validation
  async validateDataQuality(): Promise<{
    tools: { total: number; withEmbeddings: number; qualityScore: number };
    duplicates: Array<{ name: string; count: number }>;
    missingData: Array<{ id: string; name: string; issues: string[] }>;
  }> {
    const { data: tools } = await this.supabase
      .from('tools')
      .select('*')
      .eq('is_active', true);

    if (!tools) {
      throw new Error('Failed to fetch tools for quality validation');
    }

    const withEmbeddings = tools.filter(tool => tool.embedding && tool.embedding_text).length;
    const qualityScore = withEmbeddings / tools.length;

    // Find duplicates
    const nameCount = new Map<string, number>();
    tools.forEach(tool => {
      const count = nameCount.get(tool.name) || 0;
      nameCount.set(tool.name, count + 1);
    });

    const duplicates = Array.from(nameCount.entries())
      .filter(([_, count]) => count > 1)
      .map(([name, count]) => ({ name, count }));

    // Find missing data
    const missingData = tools
      .map(tool => {
        const issues: string[] = [];
        if (!tool.description || tool.description.length < 10) issues.push('description');
        if (!tool.categories || tool.categories.length === 0) issues.push('categories');
        if (!tool.embedding) issues.push('embedding');
        if (!tool.embedding_text) issues.push('embedding_text');
        if (!tool.use_cases || tool.use_cases.length === 0) issues.push('use_cases');

        return { id: tool.id, name: tool.name, issues };
      })
      .filter(item => item.issues.length > 0);

    return {
      tools: { total: tools.length, withEmbeddings, qualityScore },
      duplicates,
      missingData
    };
  }

  // Incremental update pipeline
  async runIncrementalUpdate(): Promise<{
    newTools: number;
    updatedTools: number;
    errors: Array<{source: string, error: string}>;
  }> {
    const results = { newTools: 0, updatedTools: 0, errors: [] as Array<{source: string, error: string}> };

    try {
      // Extract new/updated data from sources
      const rawData = await this.extractToolData({
        productHunt: true,
        g2: true,
      });

      // Transform and validate
      const transformedData = await this.transformToolData(rawData);

      // Identify new vs existing tools
      const existingTools = await this.getExistingToolNames();
      const newTools = transformedData.filter(tool => !existingTools.has(tool.name));
      const updatedTools = transformedData.filter(tool => existingTools.has(tool.name));

      // Load new tools
      if (newTools.length > 0) {
        const newResults = await this.loadToolsToDatabase(newTools);
        results.newTools = newResults.successful;
        results.errors.push(...newResults.errors.map(e => ({source: 'new_tools', error: e.error})));
      }

      // Update existing tools
      if (updatedTools.length > 0) {
        const updateResults = await this.loadToolsToDatabase(updatedTools);
        results.updatedTools = updateResults.successful;
        results.errors.push(...updateResults.errors.map(e => ({source: 'updated_tools', error: e.error})));
      }

    } catch (error) {
      results.errors.push({source: 'pipeline', error: String(error)});
    }

    return results;
  }

  private async getExistingToolNames(): Promise<Set<string>> {
    const { data: tools } = await this.supabase
      .from('tools')
      .select('name')
      .eq('is_active', true);

    return new Set(tools?.map(tool => tool.name) || []);
  }
}

// Airflow-style DAG configuration for scheduling
export const ETL_DAG_CONFIG = {
  dag_id: 'workflow_ai_etl',
  description: 'ETL pipeline for AI workflow recommendation data',
  schedule_interval: '0 2 * * *', // Daily at 2 AM
  start_date: '2025-01-01',
  catchup: false,
  max_active_runs: 1,
  default_args: {
    retries: 2,
    retry_delay: '5min',
    email_on_failure: true,
    email_on_retry: false,
  },
  tasks: [
    {
      task_id: 'extract_tool_data',
      operator: 'PythonOperator',
      python_callable: 'extract_data',
    },
    {
      task_id: 'transform_data',
      operator: 'PythonOperator',
      python_callable: 'transform_data',
      depends_on: ['extract_tool_data'],
    },
    {
      task_id: 'load_to_vector_db',
      operator: 'PythonOperator',
      python_callable: 'load_data',
      depends_on: ['transform_data'],
    },
    {
      task_id: 'validate_data_quality',
      operator: 'PythonOperator',
      python_callable: 'validate_quality',
      depends_on: ['load_to_vector_db'],
    },
  ],
};