-- MVP seed data for tools with minimal metrics

INSERT INTO public.tools (id, name, description, bench_score, domains, cost_index)
VALUES (gen_random_uuid(), 'Claude', 'Anthropic Claude', 0.92, ARRAY['code','reasoning'], 0.5)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.tools (id, name, description, bench_score, domains, cost_index)
VALUES (gen_random_uuid(), 'Gemini', 'Google Gemini', 0.88, ARRAY['code','general'], 0.9)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.tools (id, name, description, bench_score, domains, cost_index)
VALUES (gen_random_uuid(), 'ChatGPT', 'OpenAI ChatGPT', 0.90, ARRAY['general','code'], 0.7)
ON CONFLICT (name) DO NOTHING;


