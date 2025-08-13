-- Add tool guides and search cache tables for enhanced guide generation
-- This migration adds support for storing generated tool guides and caching web search results

BEGIN;

-- tool_guides table: Store generated user guides for tools
CREATE TABLE IF NOT EXISTS public.tool_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid REFERENCES public.tools(id) ON DELETE CASCADE,
  task_context text NOT NULL,
  guide_content jsonb NOT NULL,
  source_urls text[] DEFAULT '{}',
  confidence_score numeric(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  language text DEFAULT 'ko',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + INTERVAL '24 hours')
);

-- Indexes for tool_guides
CREATE INDEX IF NOT EXISTS idx_tool_guides_tool_context ON public.tool_guides(tool_id, task_context);
CREATE INDEX IF NOT EXISTS idx_tool_guides_expires ON public.tool_guides(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tool_guides_language ON public.tool_guides(language);
CREATE INDEX IF NOT EXISTS idx_tool_guides_confidence ON public.tool_guides(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_tool_guides_created_at ON public.tool_guides(created_at DESC);

-- search_cache table: Cache web search results to reduce API calls
CREATE TABLE IF NOT EXISTS public.search_cache (
  search_key text PRIMARY KEY,
  search_results jsonb NOT NULL,
  result_count integer DEFAULT 0,
  language text DEFAULT 'ko',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + INTERVAL '24 hours')
);

-- Indexes for search_cache
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON public.search_cache(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_search_cache_language ON public.search_cache(language);
CREATE INDEX IF NOT EXISTS idx_search_cache_created_at ON public.search_cache(created_at DESC);

-- Updated at trigger for tool_guides
CREATE TRIGGER update_tool_guides_updated_at
  BEFORE UPDATE ON public.tool_guides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies for tool_guides (public read, authenticated users can create)
ALTER TABLE public.tool_guides ENABLE ROW LEVEL SECURITY;

-- Public can read all tool guides
CREATE POLICY "Public can read tool guides" 
  ON public.tool_guides 
  FOR SELECT 
  USING (true);

-- Authenticated users can create tool guides
CREATE POLICY "Authenticated users can create tool guides" 
  ON public.tool_guides 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- System can update tool guides (for refresh/cleanup)
CREATE POLICY "System can update tool guides" 
  ON public.tool_guides 
  FOR UPDATE 
  USING (auth.role() = 'service_role');

-- System can delete expired tool guides
CREATE POLICY "System can delete expired tool guides" 
  ON public.tool_guides 
  FOR DELETE 
  USING (auth.role() = 'service_role' AND expires_at < now());

-- RLS policies for search_cache (more restrictive)
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;

-- Only service role can access search cache (internal system use)
CREATE POLICY "Service role can manage search cache" 
  ON public.search_cache 
  FOR ALL 
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to cleanup expired records (to be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer AS $$
DECLARE
  deleted_guides integer := 0;
  deleted_cache integer := 0;
BEGIN
  -- Delete expired tool guides
  DELETE FROM public.tool_guides 
  WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS deleted_guides = ROW_COUNT;
  
  -- Delete expired search cache
  DELETE FROM public.search_cache 
  WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS deleted_cache = ROW_COUNT;
  
  -- Log cleanup results
  RAISE NOTICE 'Cleanup completed: % expired guides, % expired cache entries', 
    deleted_guides, deleted_cache;
    
  RETURN deleted_guides + deleted_cache;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for active tool guides with tool information
CREATE OR REPLACE VIEW public.active_tool_guides AS
SELECT 
  tg.id,
  tg.tool_id,
  t.name as tool_name,
  t.url as tool_url,
  t.logo_url,
  tg.task_context,
  tg.guide_content,
  tg.source_urls,
  tg.confidence_score,
  tg.language,
  tg.created_at,
  tg.expires_at
FROM public.tool_guides tg
JOIN public.tools t ON tg.tool_id = t.id
WHERE tg.expires_at IS NULL OR tg.expires_at > now();

-- Grant necessary permissions
GRANT SELECT ON public.active_tool_guides TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_cache() TO service_role;

COMMIT;