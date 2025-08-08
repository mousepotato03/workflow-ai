-- MVP: Minimal columns for tool recommendation and simple policy table

-- 1) Extend tools with minimal columns
ALTER TABLE public.tools
ADD COLUMN IF NOT EXISTS bench_score NUMERIC,
ADD COLUMN IF NOT EXISTS domains TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS cost_index NUMERIC;

-- 2) Simple recommendation policy table
CREATE TABLE IF NOT EXISTS public.recommendation_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  weights JSONB NOT NULL, -- e.g., {"bench":0.6, "domain":0.3, "cost":0.1}
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security and restrict to service_role
ALTER TABLE public.recommendation_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role read" ON public.recommendation_policy;
CREATE POLICY "Service role read" ON public.recommendation_policy
  FOR SELECT USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role write" ON public.recommendation_policy;
CREATE POLICY "Service role write" ON public.recommendation_policy
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Insert default policy row (idempotent)
INSERT INTO public.recommendation_policy (name, weights)
VALUES ('default_mvp', '{"bench":0.6, "domain":0.3, "cost":0.1}')
ON CONFLICT (name) DO NOTHING;


