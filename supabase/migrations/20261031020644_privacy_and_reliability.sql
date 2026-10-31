BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Keep privileged lookup implementations out of the exposed API schema.
GRANT USAGE ON SCHEMA private TO anon;
CREATE OR REPLACE FUNCTION private.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND is_admin) $$;
CREATE OR REPLACE FUNCTION private.is_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND status='active') $$;
REVOKE ALL ON FUNCTION private.is_admin(),private.is_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin(),private.is_active() TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.is_admin() $$;
CREATE OR REPLACE FUNCTION public.is_active() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.is_active() $$;
REVOKE ALL ON FUNCTION public.is_admin(),public.is_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(),public.is_active() TO anon,authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.set_updated_at() SET search_path='';

-- Restrict identity and recovery records to their owner. Moderators may see
-- identities needed for moderation, but cannot read private recovery data.
DROP POLICY IF EXISTS profiles_select_public ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin());
REVOKE SELECT ON public.profiles FROM anon;
DROP POLICY IF EXISTS user_data_admin_select ON public.user_data;
REVOKE INSERT, UPDATE ON public.user_data FROM authenticated;

DROP POLICY IF EXISTS posts_select_community ON public.posts;
REVOKE SELECT ON public.posts FROM anon;
DROP POLICY IF EXISTS posts_admin_all ON public.posts;
DROP POLICY IF EXISTS posts_admin_read ON public.posts;
CREATE POLICY posts_admin_read ON public.posts FOR SELECT TO authenticated
USING ((select public.is_admin()) AND visibility <> 'private');
DROP POLICY IF EXISTS posts_admin_update ON public.posts;
CREATE POLICY posts_admin_update ON public.posts FOR UPDATE TO authenticated
USING ((select public.is_admin()) AND visibility <> 'private')
WITH CHECK ((select public.is_admin()) AND visibility <> 'private');
DROP POLICY IF EXISTS posts_update_own ON public.posts;
CREATE POLICY posts_update_own ON public.posts FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id AND (select public.is_active()))
WITH CHECK ((select auth.uid()) = user_id AND (select public.is_active()));
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- A sanitized projection stores only fields approved for public sharing.
-- The invoker view and direct table reads expose exactly the same safe data.
CREATE TABLE IF NOT EXISTS public.community_feed (
  id uuid PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid, body text NOT NULL, created_at timestamptz NOT NULL,
  stage text, display_name text, avatar_url text, bio text, days integer
);
ALTER TABLE public.community_feed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS community_feed_read ON public.community_feed;
CREATE POLICY community_feed_read ON public.community_feed FOR SELECT TO anon,authenticated USING(true);
REVOKE ALL ON public.community_feed FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.community_feed TO anon,authenticated;
CREATE OR REPLACE FUNCTION private.sync_community_feed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM public.community_feed WHERE id=OLD.id; RETURN NULL; END IF;
  IF NEW.visibility IN ('community','anon') AND NEW.status='active' THEN
    INSERT INTO public.community_feed(id,user_id,body,created_at,stage,display_name,avatar_url,bio,days)
    VALUES(NEW.id,CASE WHEN NEW.visibility='anon' THEN NULL ELSE NEW.user_id END,NEW.body,NEW.created_at,NEW.stage,
      CASE WHEN NEW.visibility='anon' THEN NULL ELSE NEW.display_name END,
      CASE WHEN NEW.visibility='anon' THEN NULL ELSE NEW.avatar_url END,
      CASE WHEN NEW.visibility='anon' THEN NULL ELSE NEW.bio END,NEW.days)
    ON CONFLICT(id) DO UPDATE SET user_id=EXCLUDED.user_id,body=EXCLUDED.body,created_at=EXCLUDED.created_at,stage=EXCLUDED.stage,
      display_name=EXCLUDED.display_name,avatar_url=EXCLUDED.avatar_url,bio=EXCLUDED.bio,days=EXCLUDED.days;
  ELSE DELETE FROM public.community_feed WHERE id=NEW.id;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.sync_community_feed() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS sync_public_feed ON public.posts;
CREATE TRIGGER sync_public_feed AFTER INSERT OR UPDATE OR DELETE ON public.posts FOR EACH ROW EXECUTE FUNCTION private.sync_community_feed();
INSERT INTO public.community_feed(id,user_id,body,created_at,stage,display_name,avatar_url,bio,days)
SELECT id,CASE WHEN visibility='anon' THEN NULL ELSE user_id END,body,created_at,stage,
  CASE WHEN visibility='anon' THEN NULL ELSE display_name END,
  CASE WHEN visibility='anon' THEN NULL ELSE avatar_url END,
  CASE WHEN visibility='anon' THEN NULL ELSE bio END,days
FROM public.posts WHERE visibility IN ('community','anon') AND status='active'
ON CONFLICT(id) DO UPDATE SET user_id=EXCLUDED.user_id,body=EXCLUDED.body,display_name=EXCLUDED.display_name,avatar_url=EXCLUDED.avatar_url,bio=EXCLUDED.bio,days=EXCLUDED.days,stage=EXCLUDED.stage;
DELETE FROM public.community_feed f WHERE NOT EXISTS(SELECT 1 FROM public.posts p WHERE p.id=f.id AND p.visibility IN ('community','anon') AND p.status='active');
DROP VIEW IF EXISTS public.community_posts;
CREATE VIEW public.community_posts WITH(security_invoker=true,security_barrier=true) AS
SELECT id,user_id,body,created_at,stage,display_name,avatar_url,bio,days FROM public.community_feed;
REVOKE ALL ON public.community_posts FROM PUBLIC;
GRANT SELECT ON public.community_posts TO anon,authenticated;
CREATE INDEX IF NOT EXISTS posts_owner_created ON public.posts(user_id,created_at DESC,id);
CREATE INDEX IF NOT EXISTS feed_created ON public.community_feed(created_at DESC,id);
CREATE INDEX IF NOT EXISTS reports_reporter_created ON public.reports(reporter_id,created_at DESC);
CREATE INDEX IF NOT EXISTS reports_subject ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS reports_post ON public.reports(reported_post_id);

DROP POLICY IF EXISTS reports_insert ON public.reports;
CREATE POLICY reports_insert ON public.reports FOR INSERT TO anon, authenticated
WITH CHECK (status = 'pending' AND (
  (auth.uid() IS NULL AND reporter_id IS NULL) OR
  (reporter_id = auth.uid() AND public.is_active())
));

-- Privileged fields and moderation changes are guarded and logged inside the
-- database transaction. An API caller cannot bypass them by skipping the UI.
CREATE OR REPLACE FUNCTION private.guard_moderation_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_TABLE_NAME = 'posts' THEN
      IF NEW.status <> OLD.status OR NEW.user_id <> OLD.user_id THEN
        RAISE EXCEPTION 'Moderation fields cannot be changed' USING ERRCODE = '42501';
      END IF;
    ELSIF TG_TABLE_NAME = 'profiles' THEN
      IF NEW.is_admin <> OLD.is_admin OR NEW.status <> OLD.status OR NEW.warned_count <> OLD.warned_count OR NEW.email <> OLD.email OR NEW.user_id <> OLD.user_id OR (to_jsonb(NEW)->>'role') IS DISTINCT FROM (to_jsonb(OLD)->>'role') THEN
        RAISE EXCEPTION 'Account permissions cannot be changed' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_post_moderation ON public.posts;
CREATE TRIGGER guard_post_moderation BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION private.guard_moderation_fields();
DROP TRIGGER IF EXISTS guard_profile_moderation ON public.profiles;
CREATE TRIGGER guard_profile_moderation BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.guard_moderation_fields();

CREATE OR REPLACE FUNCTION private.audit_moderation_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE action_name text; previous text; next_value text; target text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'posts' THEN
    IF NEW.status <> OLD.status THEN
      action_name := 'post.status'; previous := OLD.status; next_value := NEW.status; target := NEW.id::text;
    END IF;
  ELSIF TG_TABLE_NAME = 'reports' THEN
    IF NEW.status <> OLD.status THEN
      action_name := 'report.status'; previous := OLD.status; next_value := NEW.status; target := NEW.id::text;
    END IF;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.status <> OLD.status OR NEW.warned_count <> OLD.warned_count OR NEW.is_admin <> OLD.is_admin THEN
      action_name := 'user.moderation'; previous := jsonb_build_object('status',OLD.status,'warnings',OLD.warned_count,'admin',OLD.is_admin)::text;
      next_value := jsonb_build_object('status',NEW.status,'warnings',NEW.warned_count,'admin',NEW.is_admin)::text; target := NEW.user_id::text;
    END IF;
  END IF;
  IF action_name IS NOT NULL THEN
    INSERT INTO public.moderation_log(admin_id,action,target_type,target_id,prev_state,new_state)
    VALUES(auth.uid(),action_name,TG_TABLE_NAME,target,previous,next_value);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS audit_post_moderation ON public.posts;
CREATE TRIGGER audit_post_moderation AFTER UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION private.audit_moderation_change();
DROP TRIGGER IF EXISTS audit_report_moderation ON public.reports;
CREATE TRIGGER audit_report_moderation AFTER UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION private.audit_moderation_change();
DROP TRIGGER IF EXISTS audit_profile_moderation ON public.profiles;
CREATE TRIGGER audit_profile_moderation AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.audit_moderation_change();

ALTER TABLE public.user_data ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION private.save_recovery_data(payload jsonb, expected_revision bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner uuid := auth.uid(); next_revision bigint;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  IF octet_length(payload::text) > 2000000 THEN RAISE EXCEPTION 'Recovery data is too large'; END IF;
  INSERT INTO public.user_data(user_id,data,revision) VALUES(owner,payload,1)
    ON CONFLICT(user_id) DO UPDATE SET data=EXCLUDED.data,revision=user_data.revision+1,updated_at=now()
    WHERE user_data.revision=expected_revision
    RETURNING revision INTO next_revision;
  IF next_revision IS NULL OR (expected_revision <> 0 AND next_revision = 1) THEN
    RAISE EXCEPTION 'Saved progress changed on another device' USING ERRCODE = '40001';
  END IF;
  RETURN next_revision;
END $$;
REVOKE ALL ON FUNCTION private.save_recovery_data(jsonb,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.save_recovery_data(jsonb,bigint) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_recovery_data(payload jsonb,expected_revision bigint) RETURNS bigint
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.save_recovery_data(payload,expected_revision) $$;
REVOKE ALL ON FUNCTION public.save_recovery_data(jsonb,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_recovery_data(jsonb,bigint) TO authenticated;

-- Persisted per-account limits work across function instances and restarts.
CREATE TABLE IF NOT EXISTS public.chat_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL, requests integer NOT NULL DEFAULT 1,
  PRIMARY KEY(user_id,window_start)
);
ALTER TABLE public.chat_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_usage FROM anon, authenticated;
CREATE OR REPLACE FUNCTION private.consume_chat_request() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE owner uuid := auth.uid(); used integer;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.chat_usage(user_id,window_start) VALUES(owner,date_trunc('hour',now()))
  ON CONFLICT(user_id,window_start) DO UPDATE SET requests=chat_usage.requests+1
  WHERE chat_usage.requests < 30 RETURNING requests INTO used;
  DELETE FROM public.chat_usage WHERE user_id=owner AND window_start < now()-interval '2 hours';
  RETURN used IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION private.consume_chat_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.consume_chat_request() TO authenticated;
CREATE OR REPLACE FUNCTION public.consume_chat_request() RETURNS boolean
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.consume_chat_request() $$;
REVOKE ALL ON FUNCTION public.consume_chat_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_chat_request() TO authenticated;

-- Apply a short request burst limit to guest and account report submissions.
CREATE OR REPLACE FUNCTION private.limit_reports() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(COALESCE(auth.uid()::text,'guest-reports')));
  IF (SELECT count(*) FROM public.reports WHERE reporter_id IS NOT DISTINCT FROM auth.uid() AND created_at > now()-interval '1 hour') >= (CASE WHEN auth.uid() IS NULL THEN 30 ELSE 10 END) THEN
    RAISE EXCEPTION 'Report limit reached. Please try again later';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS limit_report_submissions ON public.reports;
CREATE TRIGGER limit_report_submissions BEFORE INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION private.limit_reports();

DROP POLICY IF EXISTS moderation_log_insert ON public.moderation_log;
REVOKE INSERT ON public.moderation_log FROM authenticated;

REVOKE ALL ON FUNCTION private.guard_moderation_fields() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.audit_moderation_change() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.limit_reports() FROM PUBLIC,anon,authenticated;
-- Deleted accounts cannot use an unexpired access token to recreate files.
CREATE OR REPLACE FUNCTION private.has_account() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid()) $$;
REVOKE ALL ON FUNCTION private.has_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_account() TO authenticated;
DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='avatars' AND (storage.foldername(name))[1]=(select auth.uid())::text AND (select private.has_account()));
DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own ON storage.objects FOR UPDATE TO authenticated
USING(bucket_id='avatars' AND (storage.foldername(name))[1]=(select auth.uid())::text AND (select private.has_account()))
WITH CHECK(bucket_id='avatars' AND (storage.foldername(name))[1]=(select auth.uid())::text AND (select private.has_account()));
DO $$ BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    INSERT INTO public.moderation_log(id,admin_id,action,target_type,target_id,prev_state,new_state,created_at)
    SELECT id,admin_id,action,target_type,target_id,prev_state,new_state,created_at FROM public.audit_log ON CONFLICT(id) DO NOTHING;
    REVOKE INSERT ON public.audit_log FROM authenticated;
  END IF;
END $$;
COMMIT;
