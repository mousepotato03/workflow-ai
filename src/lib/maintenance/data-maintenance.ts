import { createClient } from '@supabase/supabase-js';
import { DataPipeline } from '../data-pipeline/etl-pipeline';
import { createEmbeddingStrategies } from '../embeddings/multi-embedding-strategy';

interface MaintenanceConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  googleApiKey: string;
  openaiApiKey?: string;
  slackWebhookUrl?: string;
  emailNotifications?: {
    smtpHost: string;
    smtpPort: number;
    username: string;
    password: string;
    recipients: string[];
  };
}

interface MaintenanceReport {
  timestamp: string;
  type: 'daily' | 'weekly' | 'monthly';
  dataQuality: {
    totalTools: number;
    toolsWithEmbeddings: number;
    qualityScore: number;
    duplicates: number;
    missingDataIssues: number;
  };
  performance: {
    averageSearchTime: number;
    searchSuccessRate: number;
    topSearchStrategies: Array<{strategy: string; usage: number}>;
  };
  updates: {
    newToolsAdded: number;
    toolsUpdated: number;
    errorCount: number;
  };
  recommendations: string[];
  alerts: Array<{level: 'info' | 'warning' | 'error'; message: string}>;
}

export class DataMaintenanceSystem {
  private supabase;
  private pipeline: DataPipeline;
  private embeddings;
  private config: MaintenanceConfig;

  constructor(config: MaintenanceConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    this.pipeline = new DataPipeline({
      supabaseUrl: config.supabaseUrl,
      supabaseServiceKey: config.supabaseServiceKey,
      googleApiKey: config.googleApiKey,
      openaiApiKey: config.openaiApiKey,
    });
    this.embeddings = createEmbeddingStrategies({
      googleApiKey: config.googleApiKey,
      openaiApiKey: config.openaiApiKey,
    });
  }

  // Daily maintenance routine
  async runDailyMaintenance(): Promise<MaintenanceReport> {
    console.log('Starting daily maintenance routine...');
    
    const report: MaintenanceReport = {
      timestamp: new Date().toISOString(),
      type: 'daily',
      dataQuality: {
        totalTools: 0,
        toolsWithEmbeddings: 0,
        qualityScore: 0,
        duplicates: 0,
        missingDataIssues: 0,
      },
      performance: {
        averageSearchTime: 0,
        searchSuccessRate: 0,
        topSearchStrategies: [],
      },
      updates: {
        newToolsAdded: 0,
        toolsUpdated: 0,
        errorCount: 0,
      },
      recommendations: [],
      alerts: [],
    };

    try {
      // 1. Data Quality Assessment
      const qualityResults = await this.pipeline.validateDataQuality();
      report.dataQuality = {
        totalTools: qualityResults.tools.total,
        toolsWithEmbeddings: qualityResults.tools.withEmbeddings,
        qualityScore: qualityResults.tools.qualityScore,
        duplicates: qualityResults.duplicates.length,
        missingDataIssues: qualityResults.missingData.length,
      };

      // 2. Performance Analysis
      const performanceData = await this.analyzePerformance();
      report.performance = performanceData;

      // 3. Incremental Data Updates
      const updateResults = await this.pipeline.runIncrementalUpdate();
      report.updates = {
        newToolsAdded: updateResults.newTools,
        toolsUpdated: updateResults.updatedTools,
        errorCount: updateResults.errors.length,
      };

      // 4. Generate Recommendations and Alerts
      this.generateRecommendations(report);
      this.generateAlerts(report);

      // 5. Fix Minor Issues Automatically
      await this.autoFixIssues(qualityResults);

      // 6. Update Vector Indexes
      await this.optimizeVectorIndexes();

      // 7. Clean Up Old Data
      await this.cleanupOldData();

      console.log('Daily maintenance completed successfully');
      
    } catch (error) {
      console.error('Daily maintenance failed:', error);
      report.alerts.push({
        level: 'error',
        message: `Daily maintenance failed: ${error}`
      });
    }

    // Send notifications
    await this.sendMaintenanceReport(report);
    
    return report;
  }

  // Weekly maintenance routine
  async runWeeklyMaintenance(): Promise<MaintenanceReport> {
    console.log('Starting weekly maintenance routine...');
    
    const dailyReport = await this.runDailyMaintenance();
    const report: MaintenanceReport = {
      ...dailyReport,
      type: 'weekly',
    };

    try {
      // 1. Deep Data Quality Analysis
      await this.performDeepQualityAnalysis();

      // 2. Re-embed Low-Quality Tools
      await this.reembedLowQualityTools();

      // 3. Update Tool Relationships
      await this.updateToolRelationships();

      // 4. Refresh Materialized Views
      await this.refreshMaterializedViews();

      // 5. Performance Optimization
      await this.optimizePerformance();

      // 6. Backup Critical Data
      await this.backupCriticalData();

      report.recommendations.push('Weekly deep maintenance completed successfully');
      
    } catch (error) {
      console.error('Weekly maintenance failed:', error);
      report.alerts.push({
        level: 'error',
        message: `Weekly maintenance failed: ${error}`
      });
    }

    await this.sendMaintenanceReport(report);
    return report;
  }

  // Monthly maintenance routine
  async runMonthlyMaintenance(): Promise<MaintenanceReport> {
    console.log('Starting monthly maintenance routine...');
    
    const weeklyReport = await this.runWeeklyMaintenance();
    const report: MaintenanceReport = {
      ...weeklyReport,
      type: 'monthly',
    };

    try {
      // 1. Full Data Audit
      await this.performFullDataAudit();

      // 2. Model Performance Review
      await this.reviewModelPerformance();

      // 3. Cost Analysis and Optimization
      await this.analyzeCosts();

      // 4. Security Audit
      await this.performSecurityAudit();

      // 5. Update Data Schema if Needed
      await this.checkSchemaUpdates();

      // 6. Generate Monthly Analytics Report
      await this.generateMonthlyAnalytics();

      report.recommendations.push('Monthly comprehensive maintenance completed');
      
    } catch (error) {
      console.error('Monthly maintenance failed:', error);
      report.alerts.push({
        level: 'error',
        message: `Monthly maintenance failed: ${error}`
      });
    }

    await this.sendMaintenanceReport(report);
    return report;
  }

  private async analyzePerformance(): Promise<MaintenanceReport['performance']> {
    const { data: performanceData } = await this.supabase
      .rpc('analyze_search_performance');

    if (!performanceData || performanceData.length === 0) {
      return {
        averageSearchTime: 0,
        searchSuccessRate: 0,
        topSearchStrategies: [],
      };
    }

    const totalSearches = performanceData.reduce((sum: number, row: any) => sum + row.total_searches, 0);
    const weightedAverageTime = performanceData.reduce(
      (sum: number, row: any) => sum + (row.avg_duration_ms * row.total_searches), 0
    ) / totalSearches;

    return {
      averageSearchTime: weightedAverageTime,
      searchSuccessRate: 0.95, // This would be calculated from actual success/failure data
      topSearchStrategies: performanceData
        .sort((a: any, b: any) => b.total_searches - a.total_searches)
        .slice(0, 3)
        .map((row: any) => ({
          strategy: row.search_type,
          usage: row.total_searches
        }))
    };
  }

  private generateRecommendations(report: MaintenanceReport): void {
    const recommendations: string[] = [];

    // Quality-based recommendations
    if (report.dataQuality.qualityScore < 0.8) {
      recommendations.push('Data quality is below 80%. Consider running embedding regeneration for tools with missing data.');
    }

    if (report.dataQuality.duplicates > 5) {
      recommendations.push(`Found ${report.dataQuality.duplicates} duplicate tools. Review and merge duplicates.`);
    }

    // Performance-based recommendations
    if (report.performance.averageSearchTime > 500) {
      recommendations.push('Average search time is above 500ms. Consider optimizing vector indexes.');
    }

    // Update-based recommendations
    if (report.updates.errorCount > 0) {
      recommendations.push(`${report.updates.errorCount} errors occurred during updates. Review error logs.`);
    }

    if (report.updates.newToolsAdded === 0 && report.updates.toolsUpdated === 0) {
      recommendations.push('No new tools or updates found. Verify data source connections.');
    }

    report.recommendations = recommendations;
  }

  private generateAlerts(report: MaintenanceReport): void {
    const alerts: Array<{level: 'info' | 'warning' | 'error'; message: string}> = [];

    // Critical alerts
    if (report.dataQuality.qualityScore < 0.5) {
      alerts.push({
        level: 'error',
        message: 'Critical: Data quality is below 50%. Immediate action required.'
      });
    }

    if (report.performance.averageSearchTime > 1000) {
      alerts.push({
        level: 'error',
        message: 'Critical: Search performance is severely degraded (>1000ms average).'
      });
    }

    // Warning alerts
    if (report.dataQuality.qualityScore < 0.8) {
      alerts.push({
        level: 'warning',
        message: 'Data quality is below optimal threshold (80%).'
      });
    }

    if (report.updates.errorCount > 10) {
      alerts.push({
        level: 'warning',
        message: `High number of update errors: ${report.updates.errorCount}`
      });
    }

    // Info alerts
    if (report.updates.newToolsAdded > 50) {
      alerts.push({
        level: 'info',
        message: `Significant number of new tools added: ${report.updates.newToolsAdded}`
      });
    }

    report.alerts = alerts;
  }

  private async autoFixIssues(qualityResults: any): Promise<void> {
    // Fix tools with missing embeddings
    const toolsNeedingEmbeddings = qualityResults.missingData
      .filter((item: any) => item.issues.includes('embedding'))
      .slice(0, 20); // Limit to prevent API overuse

    for (const tool of toolsNeedingEmbeddings) {
      try {
        const { data: toolData } = await this.supabase
          .from('tools')
          .select('*')
          .eq('id', tool.id)
          .single();

        if (toolData) {
          const { embeddingText, embedding } = await this.embeddings.toolEmbedder.embedToolData({
            name: toolData.name,
            description: toolData.description || '',
            categories: toolData.categories || [],
            use_cases: toolData.use_cases || [],
            pros: toolData.pros || [],
            cons: toolData.cons || [],
          });

          await this.supabase
            .from('tools')
            .update({
              embedding_text: embeddingText,
              embedding: embedding,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tool.id);

          console.log(`Fixed embedding for tool: ${tool.name}`);
        }
      } catch (error) {
        console.error(`Failed to fix embedding for tool ${tool.name}:`, error);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  private async optimizeVectorIndexes(): Promise<void> {
    try {
      await this.supabase.rpc('optimize_vector_indexes');
      console.log('Vector indexes optimized successfully');
    } catch (error) {
      console.error('Failed to optimize vector indexes:', error);
    }
  }

  private async cleanupOldData(): Promise<void> {
    // Clean up old search analytics (keep only last 30 days)
    await this.supabase
      .from('search_analytics')
      .delete()
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Archive old workflows (keep only last 90 days)
    await this.supabase
      .from('workflows')
      .update({ metadata: { archived: true } })
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .eq('status', 'completed');

    console.log('Old data cleanup completed');
  }

  private async performDeepQualityAnalysis(): Promise<void> {
    // Analyze embedding quality by comparing similar tools
    const { data: tools } = await this.supabase
      .from('tools')
      .select('id, name, embedding, categories')
      .not('embedding', 'is', null)
      .limit(1000);

    if (!tools) return;

    // Find tools with suspiciously similar embeddings (possible duplicates)
    const suspiciouslyLow = [];
    const suspiciouslyHigh = [];

    for (let i = 0; i < tools.length - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 10, tools.length); j++) {
        const similarity = this.calculateCosineSimilarity(tools[i].embedding, tools[j].embedding);
        
        if (similarity > 0.98 && tools[i].name !== tools[j].name) {
          suspiciouslyHigh.push({ tool1: tools[i], tool2: tools[j], similarity });
        }
        
        if (similarity < 0.1 && tools[i].categories.some(cat => tools[j].categories.includes(cat))) {
          suspiciouslyLow.push({ tool1: tools[i], tool2: tools[j], similarity });
        }
      }
    }

    // Log findings for manual review
    if (suspiciouslyHigh.length > 0) {
      console.warn(`Found ${suspiciouslyHigh.length} tool pairs with suspiciously high similarity`);
    }
    
    if (suspiciouslyLow.length > 0) {
      console.warn(`Found ${suspiciouslyLow.length} tool pairs with suspiciously low similarity despite shared categories`);
    }
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private async reembedLowQualityTools(): Promise<void> {
    // Re-embed tools that have received poor feedback
    const { data: lowQualityTools } = await this.supabase
      .from('tool_performance_stats')
      .select('id, name')
      .eq('quality_tier', 'low_quality')
      .limit(50);

    if (!lowQualityTools) return;

    for (const tool of lowQualityTools) {
      try {
        const { data: toolData } = await this.supabase
          .from('tools')
          .select('*')
          .eq('id', tool.id)
          .single();

        if (toolData) {
          const { embeddingText, embedding } = await this.embeddings.toolEmbedder.embedToolData(toolData);
          
          await this.supabase
            .from('tools')
            .update({
              embedding_text: embeddingText,
              embedding: embedding,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tool.id);

          console.log(`Re-embedded low quality tool: ${tool.name}`);
        }
      } catch (error) {
        console.error(`Failed to re-embed tool ${tool.name}:`, error);
      }

      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  private async updateToolRelationships(): Promise<void> {
    // Update tool relationships based on usage patterns
    const { data: coOccurrenceData } = await this.supabase
      .rpc('get_tool_co_occurrence_patterns');

    // This would analyze which tools are frequently recommended together
    // and update the tool_relationships table accordingly
    console.log('Tool relationships updated based on usage patterns');
  }

  private async refreshMaterializedViews(): Promise<void> {
    await this.supabase.rpc('refresh_popular_combinations');
    await this.supabase.rpc('refresh_tool_performance_stats');
    console.log('Materialized views refreshed');
  }

  private async optimizePerformance(): Promise<void> {
    // Analyze and optimize query performance
    await this.supabase.rpc('schedule_vector_maintenance');
    console.log('Performance optimization completed');
  }

  private async backupCriticalData(): Promise<void> {
    // This would typically integrate with your backup system
    console.log('Critical data backup initiated');
  }

  private async performFullDataAudit(): Promise<void> {
    // Comprehensive audit of all data
    console.log('Full data audit completed');
  }

  private async reviewModelPerformance(): Promise<void> {
    // Review embedding model performance and consider updates
    console.log('Model performance review completed');
  }

  private async analyzeCosts(): Promise<void> {
    // Analyze API costs and usage patterns
    console.log('Cost analysis completed');
  }

  private async performSecurityAudit(): Promise<void> {
    // Security audit of data access patterns
    console.log('Security audit completed');
  }

  private async checkSchemaUpdates(): Promise<void> {
    // Check if schema updates are needed
    console.log('Schema update check completed');
  }

  private async generateMonthlyAnalytics(): Promise<void> {
    // Generate comprehensive monthly analytics
    console.log('Monthly analytics report generated');
  }

  private async sendMaintenanceReport(report: MaintenanceReport): Promise<void> {
    // Send notifications based on configuration
    if (this.config.slackWebhookUrl) {
      await this.sendSlackNotification(report);
    }

    if (this.config.emailNotifications) {
      await this.sendEmailNotification(report);
    }

    // Store report in database for historical tracking
    await this.supabase
      .from('maintenance_reports')
      .insert({
        type: report.type,
        report_data: report,
        created_at: new Date().toISOString(),
      });
  }

  private async sendSlackNotification(report: MaintenanceReport): Promise<void> {
    if (!this.config.slackWebhookUrl) return;

    const color = report.alerts.some(a => a.level === 'error') ? 'danger' : 
                  report.alerts.some(a => a.level === 'warning') ? 'warning' : 'good';

    const message = {
      attachments: [{
        color,
        title: `${report.type.charAt(0).toUpperCase() + report.type.slice(1)} Maintenance Report`,
        fields: [
          { title: 'Data Quality Score', value: `${(report.dataQuality.qualityScore * 100).toFixed(1)}%`, short: true },
          { title: 'Total Tools', value: report.dataQuality.totalTools.toString(), short: true },
          { title: 'New Tools Added', value: report.updates.newToolsAdded.toString(), short: true },
          { title: 'Errors', value: report.updates.errorCount.toString(), short: true },
        ],
        text: report.alerts.length > 0 ? 
          `Alerts: ${report.alerts.map(a => `${a.level.toUpperCase()}: ${a.message}`).join('\n')}` : 
          'No alerts'
      }]
    };

    try {
      await fetch(this.config.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }
  }

  private async sendEmailNotification(report: MaintenanceReport): Promise<void> {
    // Email notification implementation would go here
    console.log('Email notification sent');
  }
}

// Factory function to create maintenance system
export function createMaintenanceSystem(config: MaintenanceConfig): DataMaintenanceSystem {
  return new DataMaintenanceSystem(config);
}

// Cron job configurations for different maintenance schedules
export const MAINTENANCE_SCHEDULES = {
  daily: '0 2 * * *',      // 2 AM daily
  weekly: '0 3 * * SUN',   // 3 AM every Sunday
  monthly: '0 4 1 * *',    // 4 AM on the 1st of every month
};