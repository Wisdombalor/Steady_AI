import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
let db;
async function asUser(id, run) {
  await db.exec(`SET ROLE ${id ? "authenticated" : "anon"}`);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
  try { return await run(); } finally { await db.exec("RESET ROLE; RESET request.jwt.claim.sub"); }
}

before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;`);
  const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  await db.exec(schema.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', ""));
  const migration = await readFile(new URL("../supabase/migrations/202610290001_privacy_and_reliability.sql", import.meta.url), "utf8");
  await db.exec(migration);
  // Reapplying must not reopen policies or duplicate triggers.
  await db.exec(migration);
  await db.query("INSERT INTO auth.users(id,email) VALUES($1,'owner@example.test'),($2,'other@example.test'),($3,'admin@example.test')", [owner,other,admin]);
  await db.query("UPDATE public.profiles SET is_admin=true WHERE user_id=$1", [admin]);
  await db.query("INSERT INTO public.posts(user_id,body,visibility,display_name,avatar_url,bio) VALUES($1,'Anonymous story','anon','Private Identity','avatar-secret','bio-secret'),($1,'Private journal','private','Private Identity','',''),($1,'Public story','community','Public Name','','')", [owner]);
  await db.query("INSERT INTO public.user_data(user_id,data) VALUES($1,'{\"chats\":[\"private\"]}')", [owner]);
});
after(async () => { await db?.close(); });

test("guests cannot read profile emails", () => asUser(null, async () => {
  await assert.rejects(db.query("SELECT email FROM public.profiles"), /permission denied/);
}));
test("members see their own profile, not other identities", () => asUser(other, async () => {
  const result = await db.query("SELECT user_id FROM public.profiles");
  assert.deepEqual(result.rows.map((row) => row.user_id), [other]);
}));
test("anonymous feed strips identity while raw table hides anonymous and private rows", () => asUser(null, async () => {
  const feed = await db.query("SELECT * FROM public.community_posts WHERE body='Anonymous story'");
  assert.equal(feed.rows.length,1);
  for (const key of ["user_id","display_name","avatar_url","bio"]) assert.equal(feed.rows[0][key],null);
  await assert.rejects(db.query("SELECT body FROM public.posts"), /permission denied/);
}));
test("moderators cannot read private journals or another account's recovery chats", () => asUser(admin, async () => {
  assert.equal((await db.query("SELECT * FROM public.user_data WHERE user_id=$1",[owner])).rows.length,0);
  assert.equal((await db.query("SELECT * FROM public.posts WHERE visibility='private' AND user_id=$1",[owner])).rows.length,0);
}));
test("owner cannot grant themselves admin or change moderation state", () => asUser(owner, async () => {
  await assert.rejects(db.query("UPDATE public.profiles SET is_admin=true WHERE user_id=$1",[owner]), /permissions|policy/);
  await assert.rejects(db.query("UPDATE public.posts SET status='removed' WHERE user_id=$1",[owner]), /Moderation fields/);
}));
test("ordinary profile editing remains available", () => asUser(owner, async () => {
  const result=await db.query("UPDATE public.profiles SET display_name='Updated Name' WHERE user_id=$1 RETURNING display_name",[owner]);
  assert.equal(result.rows[0].display_name,"Updated Name");
}));
test("moderation is audited even when performed directly through SQL", () => asUser(admin, async () => {
  await db.query("UPDATE public.posts SET status='hidden' WHERE body='Public story'");
  const log=await db.query("SELECT action,admin_id FROM public.moderation_log WHERE action='post.status'");
  assert.equal(log.rows.length,1); assert.equal(log.rows[0].admin_id,admin);
  await assert.rejects(db.query("INSERT INTO public.moderation_log(admin_id,action,target_type,target_id) VALUES($1,'fake','post','fake')",[admin]), /permission denied/);
}));
test("suspended accounts cannot update posts or report as a guest", async () => {
  await db.query("UPDATE public.profiles SET status='suspended' WHERE user_id=$1",[owner]);
  await asUser(owner, async () => {
    const changed=await db.query("UPDATE public.posts SET visibility='community' WHERE visibility='private' RETURNING id");
    assert.equal(changed.rows.length,0);
    await assert.rejects(db.query("INSERT INTO public.reports(type,reason,reporter_id) VALUES('post','test',NULL)"), /policy/);
  });
  await db.query("UPDATE public.profiles SET status='active' WHERE user_id=$1",[owner]);
});
test("compare-and-save rejects stale data without changing saved progress", () => asUser(other, async () => {
  assert.equal((await db.query("SELECT public.save_recovery_data($1,0) AS revision",[{done:1,name:"First"}])).rows[0].revision,1);
  await assert.rejects(db.query("SELECT public.save_recovery_data($1,0)",[{name:"Stale"}]), /another device/);
  const saved=await db.query("SELECT data,revision FROM public.user_data WHERE user_id=$1",[other]);
  assert.equal(saved.rows[0].data.name,"First");assert.equal(saved.rows[0].revision,1);
  assert.equal((await db.query("SELECT public.save_recovery_data($1,1) AS revision",[{name:"Updated"}])).rows[0].revision,2);
}));
test("AI quota persists in the database and rejects requests beyond 30 per hour", () => asUser(other, async () => {
  for(let index=0;index<30;index++) assert.equal((await db.query("SELECT public.consume_chat_request() AS allowed")).rows[0].allowed,true);
  assert.equal((await db.query("SELECT public.consume_chat_request() AS allowed")).rows[0].allowed,false);
}));
