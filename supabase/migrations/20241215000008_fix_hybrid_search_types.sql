-- Fix hybrid search function return types
-- Drop and recreate with correct types

DROP FUNCTION IF EXISTS hybrid_search_tools(text, text, integer, numeric, numeric);

-- Create hybrid search function with correct return types
CREATE OR REPLACE FUNCTION hybrid_search_tools(
  query_text TEXT,
  query_embedding TEXT,
  match_count INTEGER DEFAULT 3,
  vector_weight NUMERIC DEFAULT 0.7,
  text_weight NUMERIC DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  url TEXT,
  logo_url TEXT,
  categories TEXT[],
  is_active BOOLEAN,
  hybrid_score DOUBLE PRECISION,
  vector_similarity DOUBLE PRECISION,
  text_similarity DOUBLE PRECISION
)
LANGUAGE plpgsql
AS $$
DECLARE
  query_embedding_vector vector(768);
BEGIN
  -- Parse the embedding string to vector
  query_embedding_vector := query_embedding::vector;
  
  RETURN QUERY
  WITH vector_search AS (
    SELECT 
      t.id,
      t.name,
      t.description,
      t.url,
      t.logo_url,
      t.categories,
      t.is_active,
      (1 - (t.embedding <=> query_embedding_vector))::DOUBLE PRECISION AS vector_sim
    FROM tools t
    WHERE t.is_active = true
      AND t.embedding IS NOT NULL
    ORDER BY t.embedding <=> query_embedding_vector
    LIMIT match_count * 2  -- Get more candidates for hybrid ranking
  ),
  text_search AS (
    SELECT 
      t.id,
      t.name,
      t.description,
      t.url,
      t.logo_url,
      t.categories,
      t.is_active,
      GREATEST(
        similarity(t.name, query_text),
        similarity(t.description, query_text),
        COALESCE(similarity(array_to_string(t.categories, ' '), query_text), 0)
      ) AS text_sim
    FROM tools t
    WHERE t.is_active = true
      AND (
        t.name ILIKE '%' || query_text || '%'
        OR t.description ILIKE '%' || query_text || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(t.categories) AS category 
          WHERE category ILIKE '%' || query_text || '%'
        )
      )
    ORDER BY text_sim DESC
    LIMIT match_count * 2  -- Get more candidates for hybrid ranking
  ),
  combined_results AS (
    SELECT 
      COALESCE(v.id, t.id) AS id,
      COALESCE(v.name, t.name) AS name,
      COALESCE(v.description, t.description) AS description,
      COALESCE(v.url, t.url) AS url,
      COALESCE(v.logo_url, t.logo_url) AS logo_url,
      COALESCE(v.categories, t.categories) AS categories,
      COALESCE(v.is_active, t.is_active) AS is_active,
      COALESCE(v.vector_sim, 0::DOUBLE PRECISION) AS vector_sim,
      COALESCE(t.text_sim, 0::DOUBLE PRECISION) AS text_sim
    FROM vector_search v
    FULL OUTER JOIN text_search t ON v.id = t.id
  )
  SELECT 
    cr.id,
    cr.name,
    cr.description,
    cr.url,
    cr.logo_url,
    cr.categories,
    cr.is_active,
    (cr.vector_sim * vector_weight::DOUBLE PRECISION + cr.text_sim * text_weight::DOUBLE PRECISION) AS hybrid_score,
    cr.vector_sim AS vector_similarity,
    cr.text_sim AS text_similarity
  FROM combined_results cr
  WHERE cr.is_active = true
  ORDER BY hybrid_score DESC
  LIMIT match_count;
END;
$$;