-- Create function for vector similarity search (LangChain compatible)
CREATE OR REPLACE FUNCTION match_tools(
  query_embedding vector(768),
  match_count int DEFAULT 3,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tools.id,
    tools.embedding_text as content,
    jsonb_build_object(
      'id', tools.id,
      'name', tools.name,
      'description', tools.description,
      'url', tools.url,
      'logo_url', tools.logo_url,
      'categories', tools.categories,
      'pros', tools.pros,
      'cons', tools.cons,
      'recommendation_tip', tools.recommendation_tip
    ) as metadata,
    1 - (tools.embedding <=> query_embedding) AS similarity
  FROM tools
  WHERE 
    tools.is_active = true
    AND tools.embedding IS NOT NULL
    AND (filter = '{}' OR jsonb_build_object(
      'id', tools.id,
      'name', tools.name,
      'description', tools.description,
      'url', tools.url,
      'logo_url', tools.logo_url,
      'categories', tools.categories,
      'pros', tools.pros,
      'cons', tools.cons,
      'recommendation_tip', tools.recommendation_tip
    ) @> filter)
  ORDER BY tools.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$; 