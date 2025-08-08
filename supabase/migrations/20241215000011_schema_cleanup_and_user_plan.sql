-- Schema cleanup and user plan introduction
-- Changes:
-- 1) tasks: remove 5-step limit, drop description column
-- 2) tools: drop pros, cons, recommendation_tip columns
-- 3) Drop feedback, tool_interactions, reviews tables
-- 4) users: add plan (free|plus)
-- 5) Rename inquiries -> contact (with index/trigger renames)

BEGIN;

-- 1) tasks: remove 5-step limit and keep minimal lower-bound (>=1). Drop description column.
-- Drop any existing CHECK constraints that enforce an upper bound (<= 5) on order_index
DO $$
DECLARE
  cons RECORD;
BEGIN
  FOR cons IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.tasks'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%order_index%'
      AND (
        pg_get_constraintdef(oid) ILIKE '%<= 5%'
        OR pg_get_constraintdef(oid) ILIKE '%<=5%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS %I', cons.conname);
  END LOOP;
END $$;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_order_index_min_check CHECK (order_index >= 1);
ALTER TABLE public.tasks DROP COLUMN IF EXISTS description;

-- 2) tools: drop unused descriptive columns
ALTER TABLE public.tools DROP COLUMN IF EXISTS pros;
ALTER TABLE public.tools DROP COLUMN IF EXISTS cons;
ALTER TABLE public.tools DROP COLUMN IF EXISTS recommendation_tip;

-- 3) remove workflow-level feedback and tool-level interactions/reviews
DROP TABLE IF EXISTS public.feedback CASCADE;
DROP TABLE IF EXISTS public.tool_interactions CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;

-- 4) users: add plan (free|plus)
DO $$ BEGIN
  CREATE TYPE public.user_plan AS ENUM ('free', 'plus');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan public.user_plan NOT NULL DEFAULT 'free';

-- 5) inquiries -> contact rename
-- Rename table (assumes contact does not already exist)
ALTER TABLE IF EXISTS public.inquiries RENAME TO contact;

-- Rename indexes if present
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_inquiries_type') THEN
    ALTER INDEX idx_inquiries_type RENAME TO idx_contact_type;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_inquiries_user_id') THEN
    ALTER INDEX idx_inquiries_user_id RENAME TO idx_contact_user_id;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_inquiries_created_at') THEN
    ALTER INDEX idx_inquiries_created_at RENAME TO idx_contact_created_at;
  END IF;
END $$;

-- Rename updated_at trigger if it exists on the renamed table
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname = 'update_inquiries_updated_at' AND c.relname = 'contact'
  ) THEN
    ALTER TRIGGER update_inquiries_updated_at ON public.contact RENAME TO update_contact_updated_at;
  END IF;
END $$;

COMMIT;


