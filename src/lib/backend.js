import { createClient } from "@supabase/supabase-js";
import { SB_CONF, FORM } from "./data";

let client = null;
export function supabase() {
  if (!client) {
    client = createClient(SB_CONF.url, SB_CONF.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export async function sendReport(subject, f, onQueued) {
  try {
    const r = await fetch(FORM, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ _subject: subject, _captcha: "false", _template: "table", ...f }),
    });
    if (!r.ok) throw new Error("send failed");
    return true;
  } catch {
    if (onQueued) onQueued({ subject, f, t: Date.now() });
    return false;
  }
}

export async function loadPosts(user) {
  const a = supabase();
  const [pub, own] = await Promise.all([
    a.from("community_posts").select("*").order("created_at", { ascending: false }).limit(100),
    user ? a.from("posts").select("*").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
  ]);
  if (pub.error) throw pub.error;
  // Ownership is decided per-row by author id. (The `own` query can also
  // return other people's public posts via the community read policy, so
  // membership in its result must NOT imply ownership.)
  const uid = user?.id || null;
  const mp = new Map();
  const m = (x, v) => ({
    id: x.id,
    t: x.body,
    v,
    d: new Date(x.created_at).getTime(),
    stage: x.stage,
    n: x.display_name,
    mine: !!uid && x.user_id != null && x.user_id === uid,
    au: x.user_id ?? null,
    av: x.avatar_url ?? null,
    bio: x.bio ?? null,
    day: x.days ?? null,
    status: x.status ?? "active",
  });
  (pub.data || []).forEach((x) => mp.set(x.id, m(x, x.display_name === null ? "anon" : "com")));
  (own.data || []).forEach((x) =>
    mp.set(x.id, m(x, x.visibility === "private" ? "me" : x.visibility === "anon" ? "anon" : "com"))
  );
  return [...mp.values()];
}

// Insert a community post, attaching the author's public profile snapshot
// (avatar, bio, days) when the table has those columns. Falls back to the
// base columns on older schemas so posting never breaks.
export async function insertPost(a, base) {
  const ext = { avatar_url: base._av || null, bio: base._bio || null, days: base._days ?? null };
  const { _av, _bio, _days, ...core } = base;
  try {
    const r = await a.from("posts").insert({ ...core, ...ext });
    if (r.error) throw r.error;
    return r;
  } catch (e) {
    const msg = String(e?.message || "");
    if (!/column|schema cache|42703|PGRST204/i.test(msg)) throw e;
    const r2 = await a.from("posts").insert(core);
    if (r2.error) throw r2.error;
    return r2;
  }
}

export const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ""));

// The caller's own moderation state. Never throws: on any error (e.g.
// pre-schema database) it fails open to a plain user so the app keeps
// working; the admin gate independently requires the is_admin flag.
export async function getModState(userId) {
  try {
    if (!userId) return { role: "user", status: "active" };
    const a = supabase();
    const { data, error } = await a.from("profiles").select("is_admin,status").eq("user_id", userId).maybeSingle();
    if (error || !data) return { role: "user", status: "active" };
    return { role: data.is_admin ? "admin" : "user", status: data.status || "active" };
  } catch {
    return { role: "user", status: "active" };
  }
}

// Keep the public profile row in sync after sign-in. Creates it on first
// login (also guarantees the strict is_active() check has a row to read).
export async function syncProfile(user, { displayName, avatarUrl, bio }) {
  const a = supabase();
  const { error } = await a.from("profiles").upsert(
    { user_id: user.id, display_name: displayName || "", avatar_url: avatarUrl || "", bio: bio || "" },
    { onConflict: "user_id" }
  );
  if (error) throw error;
}

// File a moderation report. Suspended users and schema problems surface as
// thrown errors for the UI to display.
export async function createReport({ reporterId, kind, reason, details, post, userId, userName }) {
  const a = supabase();
  const row = {
    reporter_id: reporterId || null,
    type: kind,
    reason,
    details: details || null,
    status: "pending",
    reported_user_id: null,
    reported_post_id: null,
    reported_body: null,
    reported_display_name: null,
  };
  if (kind === "post" && post) {
    row.reported_post_id = isUuid(post.id) ? post.id : null;
    row.reported_user_id = isUuid(post.au) ? post.au : (isUuid(userId) ? userId : null);
    row.reported_body = post.t || null;
    row.reported_display_name = post.v === "anon" ? null : (post.n || userName || null);
  }
  if (kind === "user") {
    row.reported_user_id = isUuid(userId) ? userId : null;
    row.reported_display_name = userName || null;
  }
  // Insert only, no returning select: reading reports back is admin-only
  // under RLS, so chaining .select() would fail for guests and normal users
  // even though the report itself was filed.
  const { error } = await a.from("reports").insert(row);
  if (error) throw error;
  return true;
}

// Append to the admin moderation log. Throws when the caller lacks admin rights.
export async function writeAudit(adminId, action, targetType, targetId, prevState, newState) {
  const a = supabase();
  const { error } = await a.from("moderation_log").insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: String(targetId),
    prev_state: prevState ?? null,
    new_state: newState ?? null,
  });
  if (error) throw error;
}

// Upload a profile picture to the `avatars` storage bucket (must exist and be
// public). Returns a public URL. Throws a friendly Error when misconfigured.
export async function uploadAvatar(file, userId) {
  if (!file || !file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 2 * 1024 * 1024) throw new Error("Please choose an image under 2MB.");
  const a = supabase();
  const ext = ((file.name || "").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "jpg";
  const path = `${userId}/avatar.${ext}`;
  const { error } = await a.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) {
    if (/bucket|not found|404/i.test(error.message || "")) {
      throw new Error("Avatar uploads need a public 'avatars' storage bucket in Supabase (Storage → New bucket → public).");
    }
    throw new Error(error.message || "Couldn't upload the picture. Try again.");
  }
  const { data } = a.storage.from("avatars").getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) throw new Error("Couldn't upload the picture. Try again.");
  return url;
}
