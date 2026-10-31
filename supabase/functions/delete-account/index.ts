import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { createDeleteHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(createDeleteHandler({
  async authenticate(token: string) {
    const { data, error } = await admin.auth.getUser(token);
    return error ? null : data.user?.id || null;
  },
  async removeData(owner: string, token: string) {
    const revoked = await admin.auth.admin.signOut(token, "global");
    if (revoked.error) throw revoked.error;
    // Walk folders too: an account can upload nested objects through the API.
    const removeFolder = async (prefix: string): Promise<void> => {
      for (;;) {
        const listed = await admin.storage.from("avatars").list(prefix, { limit: 100 });
        if (listed.error) throw listed.error;
        if (!listed.data?.length) return;
        const files: string[] = [];
        for (const file of listed.data) {
          if (file.id) files.push(`${prefix}/${file.name}`);
          else await removeFolder(`${prefix}/${file.name}`);
        }
        if (files.length) {
          const removed = await admin.storage.from("avatars").remove(files);
          if (removed.error) throw removed.error;
        }
      }
    };
    await removeFolder(owner);
    const reports = await admin.from("reports").delete().or(`reporter_id.eq.${owner},reported_user_id.eq.${owner}`);
    if (reports.error) throw reports.error;
    for (let offset = 0; ; offset += 100) {
      const posts = await admin.from("posts").select("id").eq("user_id", owner).order("id").range(offset, offset + 99);
      if (posts.error) throw posts.error;
      if (!posts.data?.length) break;
      const snapshots = await admin.from("reports").delete().in("reported_post_id", posts.data.map((post) => post.id));
      if (snapshots.error) throw snapshots.error;
    }
    const deleted = await admin.auth.admin.deleteUser(owner);
    if (deleted.error) throw deleted.error;
  },
}));
