-- Snapshot of current DB state (idempotent)
-- Focus: tools, users(public), contact, supporting triggers/indexes/RLS

BEGIN;

-- Ensure enums
DO $$ BEGIN
  CREATE TYPE public.inquiry_type AS ENUM ('general', 'partnership', 'support', 'feedback');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.user_plan AS ENUM ('free', 'plus');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ensure updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- tools
CREATE TABLE IF NOT EXISTS public.tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  name text UNIQUE NOT NULL,
  description text,
  url text,
  logo_url text,
  categories text[] DEFAULT '{}',
  embedding_text text,
  embedding vector,
  is_active boolean DEFAULT true,
  bench_score numeric,
  domains text[] DEFAULT '{}',
  cost_index numeric
);

-- tools indexes
CREATE INDEX IF NOT EXISTS idx_tools_name ON public.tools(name);
CREATE INDEX IF NOT EXISTS idx_tools_name_gin ON public.tools USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tools_categories ON public.tools USING gin (categories);
CREATE INDEX IF NOT EXISTS idx_tools_description_gin ON public.tools USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tools_active ON public.tools (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_tools_active_with_embedding ON public.tools (is_active) WHERE ((is_active = true) AND (embedding IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_tools_embedding_optimized ON public.tools USING ivfflat (embedding vector_cosine_ops) WITH (lists='10');

-- tools trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname = 'update_tools_updated_at' AND c.relname = 'tools'
  ) THEN
    CREATE TRIGGER update_tools_updated_at
      BEFORE UPDATE ON public.tools
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- tools RLS (public read)
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read tools" ON public.tools;
CREATE POLICY "Public can read tools" ON public.tools FOR SELECT USING (true);

-- users (public)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  plan public.user_plan NOT NULL DEFAULT 'free',
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- users trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname = 'update_users_updated_at' AND c.relname = 'users'
  ) THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- contact
CREATE TABLE IF NOT EXISTS public.contact (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  inquiry_type public.inquiry_type NOT NULL DEFAULT 'general',
  email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  message TEXT NOT NULL CHECK (char_length(message) >= 10 AND char_length(message) <= 2000),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- contact indexes
CREATE INDEX IF NOT EXISTS idx_contact_type ON public.contact(inquiry_type);
CREATE INDEX IF NOT EXISTS idx_contact_user_id ON public.contact(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_created_at ON public.contact(created_at DESC);

-- contact trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname = 'update_contact_updated_at' AND c.relname = 'contact'
  ) THEN
    CREATE TRIGGER update_contact_updated_at
      BEFORE UPDATE ON public.contact
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- contact RLS policies
ALTER TABLE public.contact ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can create contact" ON public.contact;
CREATE POLICY "Anyone can create contact" ON public.contact FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can view their own contact" ON public.contact;
CREATE POLICY "Users can view their own contact" ON public.contact FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

COMMIT;


