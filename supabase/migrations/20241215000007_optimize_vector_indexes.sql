-- Optimize vector indexes for better performance with smaller datasets
-- Drop existing indexes first
DROP INDEX IF EXISTS idx_tools_embedding;
DROP INDEX IF EXISTS idx_tools_embedding_optimized;

-- Recreate with optimized parameters for smaller datasets
-- Using lists=10 which is more appropriate for datasets with < 1000 vectors
CREATE INDEX idx_tools_embedding_optimized ON tools 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 10);

-- Create composite index for active tools with embeddings
CREATE INDEX IF NOT EXISTS idx_tools_active_with_embedding 
ON tools(is_active) 
WHERE is_active = true AND embedding IS NOT NULL;

-- Create index for category-based filtering
CREATE INDEX IF NOT EXISTS idx_tools_categories_gin 
ON tools USING gin(categories);

-- Create index for difficulty and budget filtering (if these columns exist)
-- These would be added when user preferences are extended
-- CREATE INDEX IF NOT EXISTS idx_tools_difficulty ON tools(difficulty_level) WHERE difficulty_level IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_tools_budget ON tools(budget_range) WHERE budget_range IS NOT NULL;

-- Update table statistics for query planner
ANALYZE tools;

-- Create materialized view for frequently accessed tool data
CREATE MATERIALIZED VIEW IF NOT EXISTS active_tools_with_embeddings AS
SELECT 
  id,
  name,
  description,
  url,
  logo_url,
  categories,
  embedding,
  created_at,
  updated_at
FROM tools 
WHERE is_active = true 
  AND embedding IS NOT NULL;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_active_tools_embedding 
ON active_tools_with_embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 5);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_active_tools_view()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY active_tools_with_embeddings;
  ANALYZE active_tools_with_embeddings;
END;
$$;

-- Create scheduled function to auto-refresh the materialized view (if needed)
-- This would require pg_cron extension
-- SELECT cron.schedule('refresh-active-tools', '0 2 * * *', 'SELECT refresh_active_tools_view();');

-- Performance monitoring query
-- Use this to check index usage
CREATE OR REPLACE FUNCTION check_vector_index_performance()
RETURNS TABLE (
  index_name text,
  schemaname text,
  relname text,
  idx_scan bigint,
  idx_tup_read bigint,
  idx_tup_fetch bigint
)
LANGUAGE sql
AS $$
  SELECT 
    indexrelname::text as index_name,
    schemaname,
    relname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
  FROM pg_stat_user_indexes 
  WHERE relname IN ('tools', 'active_tools_with_embeddings')
    AND indexrelname LIKE '%embedding%'
  ORDER BY idx_scan DESC;
$$;