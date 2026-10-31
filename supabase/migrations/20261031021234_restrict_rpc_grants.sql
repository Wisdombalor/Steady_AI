BEGIN;
-- Supabase can grant anon/authenticated EXECUTE through default privileges,
-- independently of PostgreSQL's PUBLIC grant. Revoke all three explicitly.
REVOKE ALL ON FUNCTION public.save_recovery_data(jsonb,bigint),private.save_recovery_data(jsonb,bigint),public.consume_chat_request(),private.consume_chat_request(),private.has_account() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_recovery_data(jsonb,bigint),private.save_recovery_data(jsonb,bigint),public.consume_chat_request(),private.consume_chat_request(),private.has_account() TO authenticated;

-- Quota counters are internal. All client access stays denied even if a
-- future deployment accidentally restores table grants.
DROP POLICY IF EXISTS chat_usage_deny_clients ON public.chat_usage;
CREATE POLICY chat_usage_deny_clients ON public.chat_usage FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
COMMIT;
