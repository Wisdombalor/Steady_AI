-- Steady database schema: app tables + admin and moderation system.
--
-- HOW TO APPLY
--   1. Supabase Dashboard → SQL Editor → New query → paste this entire file → Run.
--      Expect "Success". Safe to re-run (everything is IF NOT EXISTS / OR REPLACE).
--   2. Verify these exist (Table Editor): posts, profiles, reports, moderation_log.
--   3. Log in once as wisdomudohwest@gmail.com (creates the user + profile rows).
--   4. Still in SQL Editor, run:
--        update public.profiles set is_admin = true where email = 'wisdomudohwest@gmail.com';
--   5. Verify: SELECT user_id, email, is_admin, status FROM public.profiles WHERE is_admin;
--   6. Open /#/admin (with the hash – plain /admin never works on static hosting).
--
-- WHAT THIS CREATES
--   public.profiles         is_admin flag, status (active/suspended/banned), public profile data
--   public.posts            community/private posts with moderation state (active/hidden/removed)
--   public.community_posts  read-only view of active community + anonymous posts
--   public.user_data        per-user synced app data (owner + admin only)
--   public.reports          user reports (pending/reviewed/resolved/dismissed)
--   public.moderation_log   append-only admin action log
--   storage bucket `avatars` (public read, users manage only their own folder)
--   Row Level Security on everything: normal users CANNOT reach admin rows or
--   endpoints even by calling the API directly; admin checks run server-side.
--
-- NOTE: order matters in this file. Tables are created first, then the
-- helper functions that read them, then policies/triggers. Do not reorder.

-- ---------------------------------------------------------------- extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------- tables
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT '',
  avatar_url   text NOT NULL DEFAULT '',
  bio          text NOT NULL DEFAULT '',
  is_admin     boolean NOT NULL DEFAULT false,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  warned_count integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.posts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body         text NOT NULL,
  visibility   text NOT NULL DEFAULT 'community' CHECK (visibility IN ('private', 'anon', 'community')),
  stage        text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT '',
  avatar_url   text,
  bio          text,
  days         integer,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'removed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_data (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_post_id    uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  reported_body       text,
  reported_display_name text,
  type                text NOT NULL CHECK (type IN ('post', 'user', 'comment', 'message')),
  reason              text NOT NULL,
  details             text,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moderation_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   text NOT NULL,
  prev_state  text,
  new_state   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- upgrades
-- Bring deployments of the earlier migration file up to this schema.
-- Safe to run whether the old tables exist or not.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL AND to_regclass('public.moderation_log') IS NULL THEN
    ALTER TABLE public.audit_log RENAME TO moderation_log;
  END IF;
END $$;
-- Backfill emails for rows created before the email column existed.
-- (The legacy `role` column is left untouched and no longer read.)
UPDATE public.profiles p SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND (p.email IS NULL OR p.email = '') AND u.email IS NOT NULL;

-- ---------------------------------------------------------------- helpers
-- (Defined AFTER the tables because SQL-language functions validate
-- referenced tables at creation time.)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin
); $$;

-- Strict: no profile row (or non-active status) => NOT allowed to write.
CREATE OR REPLACE FUNCTION public.is_active()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT COALESCE(
  (SELECT p.status = 'active' FROM public.profiles p WHERE p.user_id = auth.uid()),
  false
); $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Auto-create a profile row for every new auth user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

-- ---------------------------------------------------------------- RLS: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_public ON public.profiles;
CREATE POLICY profiles_select_public ON public.profiles
FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND is_admin = false AND status = 'active');

-- Owners may edit only their public fields; is_admin/status/warned_count/email
-- are locked to their current values (admins use the admin policy below).
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_admin = (SELECT p.is_admin FROM public.profiles p WHERE p.user_id = auth.uid())
  AND email = (SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid())
  AND status = (SELECT p.status FROM public.profiles p WHERE p.user_id = auth.uid())
  AND warned_count = (SELECT p.warned_count FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all ON public.profiles
FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------- RLS: posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Public community feed: active community + anonymous posts.
DROP POLICY IF EXISTS posts_select_community ON public.posts;
CREATE POLICY posts_select_community ON public.posts
FOR SELECT TO anon, authenticated
USING (visibility IN ('community', 'anon') AND status = 'active');

-- Owners can always read their own rows (any visibility/state).
DROP POLICY IF EXISTS posts_select_own ON public.posts;
CREATE POLICY posts_select_own ON public.posts
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Owners can insert while their account is active. Suspended/banned
-- users are rejected here, server-side.
DROP POLICY IF EXISTS posts_insert_own ON public.posts;
CREATE POLICY posts_insert_own ON public.posts
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'active' AND public.is_active());

-- Owners can delete their own rows.
DROP POLICY IF EXISTS posts_delete_own ON public.posts;
CREATE POLICY posts_delete_own ON public.posts
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Owners can edit their own rows (e.g. switch visibility between private
-- and anonymous) but can NEVER change moderation state; only admins update
-- status, enforced by comparing against the stored row server-side.
DROP POLICY IF EXISTS posts_update_own ON public.posts;
CREATE POLICY posts_update_own ON public.posts
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND status = (SELECT p.status FROM public.posts p WHERE p.id = posts.id)
);

DROP POLICY IF EXISTS posts_admin_all ON public.posts;
CREATE POLICY posts_admin_all ON public.posts
FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------- RLS: user_data
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_data_owner_all ON public.user_data;
CREATE POLICY user_data_owner_all ON public.user_data
FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_data_admin_select ON public.user_data;
CREATE POLICY user_data_admin_select ON public.user_data
FOR SELECT TO authenticated USING (public.is_admin());

-- ---------------------------------------------------------------- RLS: reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Anyone (including guests) can file; status is forced to pending;
-- logged-in reporters must be active and report as themselves.
DROP POLICY IF EXISTS reports_insert ON public.reports;
CREATE POLICY reports_insert ON public.reports
FOR INSERT TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND (reporter_id IS NULL OR (reporter_id = auth.uid() AND public.is_active()))
);

-- Only admins read/update/delete reports.
DROP POLICY IF EXISTS reports_admin_all ON public.reports;
CREATE POLICY reports_admin_all ON public.reports
FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------- RLS: moderation_log (append-only)
ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moderation_log_insert ON public.moderation_log;
CREATE POLICY moderation_log_insert ON public.moderation_log
FOR INSERT TO authenticated
WITH CHECK (public.is_admin() AND admin_id = auth.uid());

DROP POLICY IF EXISTS moderation_log_select ON public.moderation_log;
CREATE POLICY moderation_log_select ON public.moderation_log
FOR SELECT TO authenticated USING (public.is_admin());

-- No UPDATE/DELETE policies: the log is append-only.

-- ---------------------------------------------------------------- triggers
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS posts_updated_at ON public.posts;
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS reports_updated_at ON public.reports;
CREATE TRIGGER reports_updated_at BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill for accounts created before this schema (email included).
INSERT INTO public.profiles (user_id, email)
SELECT id, COALESCE(email, '') FROM auth.users
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

-- ---------------------------------------------------------------- community_posts view
-- What the app's community feed reads. Anonymous posts expose NULL identity.
DROP VIEW IF EXISTS public.community_posts;
CREATE VIEW public.community_posts WITH (security_invoker = true) AS
SELECT
  id,
  -- Author id is exposed so reports can link to the author and admins can
  -- moderate them. UUIDs alone grant no extra access (RLS still applies).
  CASE WHEN visibility = 'anon' THEN NULL ELSE user_id END AS user_id,
  body,
  created_at,
  stage,
  CASE WHEN visibility = 'anon' THEN NULL ELSE display_name END AS display_name,
  CASE WHEN visibility = 'anon' THEN NULL ELSE avatar_url END AS avatar_url,
  CASE WHEN visibility = 'anon' THEN NULL ELSE bio END AS bio,
  days
FROM public.posts
WHERE visibility IN ('community', 'anon') AND status = 'active';

GRANT SELECT ON public.community_posts TO anon, authenticated;

-- ---------------------------------------------------------------- grants (explicit, least privilege)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO authenticated;
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT INSERT ON public.reports TO anon;
GRANT SELECT, INSERT ON public.moderation_log TO authenticated;

-- ---------------------------------------------------------------- storage: avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_public_read ON storage.objects
FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- first admin
-- After signing in as the intended admin, run:
--   update public.profiles set is_admin = true where email = 'wisdomudohwest@gmail.com';
-- Verify with:
--   SELECT user_id, email, is_admin, status FROM public.profiles WHERE is_admin;
