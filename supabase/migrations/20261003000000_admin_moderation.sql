-- Steady admin & moderation system.
--
-- HOW TO APPLY
--   1. Supabase Dashboard → SQL Editor → paste this entire file → Run.
--   2. Sign up / sign in with the account that should become the first admin.
--   3. Find its user id: Authentication → Users → copy the UUID,
--      or run:  SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;
--   4. Promote it (ONLY ever run this manually — there is no API to self-promote):
--        UPDATE public.profiles SET role = 'admin' WHERE user_id = '<paste-uuid-here>';
--   5. Open the app at #/admin while signed in as that account.
--
-- WHAT THIS CREATES
--   public.profiles         roles (user/admin), status (active/suspended/banned), public profile data
--   public.posts            community/private posts with moderation state (active/hidden/removed)
--   public.community_posts  read-only view of active community posts (anon-safe display names)
--   public.user_data        per-user synced app data (owner + admin only)
--   public.reports          user reports (pending/reviewed/resolved/dismissed)
--   public.audit_log        append-only admin action log
--   storage bucket `avatars` (public read, users manage only their own folder)
--   Row Level Security on everything: normal users CANNOT reach admin rows or
--   endpoints even by calling the API directly; admin checks run server-side.

-- ---------------------------------------------------------------- extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'
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

-- ---------------------------------------------------------------- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url   text NOT NULL DEFAULT '',
  bio          text NOT NULL DEFAULT '',
  role         text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  warned_count integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_public ON public.profiles;
CREATE POLICY profiles_select_public ON public.profiles
FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'user' AND status = 'active');

-- Owners may edit only their public fields; role/status/warned_count are
-- locked to their current values (admins use the admin policy below).
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
  AND status = (SELECT p.status FROM public.profiles p WHERE p.user_id = auth.uid())
  AND warned_count = (SELECT p.warned_count FROM public.profiles p WHERE p.user_id = auth.uid())
);

DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all ON public.profiles
FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Auto-create a profile row for every new auth user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill for accounts created before this migration.
INSERT INTO public.profiles (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------- posts
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

DROP TRIGGER IF EXISTS posts_updated_at ON public.posts;
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Public community feed: only active community posts.
DROP POLICY IF EXISTS posts_select_community ON public.posts;
CREATE POLICY posts_select_community ON public.posts
FOR SELECT TO anon, authenticated
USING (visibility = 'community' AND status = 'active');

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

-- Owners can delete their own rows. Owners CANNOT update (so moderation
-- state can't be flipped back); only admins update.
DROP POLICY IF EXISTS posts_delete_own ON public.posts;
CREATE POLICY posts_delete_own ON public.posts
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS posts_admin_all ON public.posts;
CREATE POLICY posts_admin_all ON public.posts
FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

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
WHERE visibility = 'community' AND status = 'active';

GRANT SELECT ON public.community_posts TO anon, authenticated;

-- ---------------------------------------------------------------- user_data
CREATE TABLE IF NOT EXISTS public.user_data (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_data_owner_all ON public.user_data;
CREATE POLICY user_data_owner_all ON public.user_data
FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_data_admin_select ON public.user_data;
CREATE POLICY user_data_admin_select ON public.user_data
FOR SELECT TO authenticated USING (public.is_admin());

-- ---------------------------------------------------------------- reports
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

DROP TRIGGER IF EXISTS reports_updated_at ON public.reports;
CREATE TRIGGER reports_updated_at BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

-- ---------------------------------------------------------------- audit_log (append-only)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   text NOT NULL,
  prev_state  text,
  new_state   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE POLICY audit_log_insert ON public.audit_log
FOR INSERT TO authenticated
WITH CHECK (public.is_admin() AND admin_id = auth.uid());

DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log
FOR SELECT TO authenticated USING (public.is_admin());

-- No UPDATE/DELETE policies: the log is append-only.

-- ---------------------------------------------------------------- grants (explicit, least privilege)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, DELETE ON public.posts TO authenticated;
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO authenticated;
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT INSERT ON public.reports TO anon;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;

-- ---------------------------------------------------------------- first admin
-- After signing in as the intended admin, run:
--   UPDATE public.profiles SET role = 'admin' WHERE user_id = '<uuid-from-Auth-Users>';
-- Verify with:
--   SELECT user_id, display_name, role, status FROM public.profiles WHERE role = 'admin';
