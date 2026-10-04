import { useEffect, useState } from "react";
import { supabase, writeAudit } from "../lib/backend";
import { ADMIN_EMAILS } from "../lib/data";
import { Login, Signup } from "./Onboarding";
import { Chips } from "./Chrome";

const NAV = [["/", "Dashboard"], ["/reports", "Reports"], ["/posts", "Posts"], ["/users", "Users"], ["/history", "History"]];

function dbErr(e) {
  const m = String(e?.message || "");
  if (/Could not find the table|schema cache|PGRST205/i.test(m))
    return "Database tables missing — run supabase/schema.sql in the Supabase SQL Editor.";
  if (/row-level security|policy|permission|42501/i.test(m)) return "Not allowed (admin rights required).";
  if (/Failed to fetch|Network/i.test(m)) return "Network problem. Check your connection.";
  return m || "Something went wrong.";
}

async function logAudit(adminId, action, targetType, targetId, prev, next) {
  try {
    await writeAudit(adminId, action, targetType, targetId, prev, next);
    return null;
  } catch (e) {
    return dbErr(e);
  }
}

export function AdminApp({ user, mod, path, store, update, onAuth, authMode, setAuthMode, onExit, onSignOut, refreshMod }) {
  const [checking, setChecking] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [mode, setMode] = useState("login");
  if (!user) {
    return (
      <div className="in">
        <div className="ob in" style={{ marginTop: 0 }}>
          <button className="chip" onClick={onExit}>← Back to Steady</button>
          <h1>Admin sign in</h1>
          <p className="mu">The admin area requires a signed-in admin account.</p>
          {mode === "login" ? (
            <Login setAuthMode={(m) => { if (m === "start") onExit(); else if (m === "signup") setMode("signup"); }} onAuth={onAuth} />
          ) : (
            <Signup store={store} update={update} setAuthMode={(m) => { if (m === "start") onExit(); else if (m === "login") setMode("login"); }} onAuth={onAuth} />
          )}
          <p className="mu" style={{ textAlign: "center" }}>
            {mode === "login" ? (
              <>No account? <button className="tel" onClick={() => setMode("signup")}>Sign up</button></>
            ) : (
              <>Have an account? <button className="tel" onClick={() => setMode("login")}>Log in</button></>
            )}
          </p>
        </div>
      </div>
    );
  }
  if (mod.role !== "admin") {
    const listed = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
    return (
      <div className="in">
        <div className="ob in" style={{ marginTop: 0 }}>
          <h1>Access denied</h1>
          <p className="mu">This area is for Steady admins only. Your account ({user.email}) doesn&apos;t have the admin flag.</p>
          {listed ? (
            <div className="card">
              <b>Finish admin setup</b>
              <p className="mu">This email is listed as an owner, but the database flag isn&apos;t set yet. Run this in the Supabase SQL Editor, then check again:</p>
              <p className="mu" style={{ wordBreak: "break-all" }}><code>update public.profiles set is_admin = true where email = &apos;{user.email}&apos;;</code></p>
              <p className="mu">Make sure it reports 1 row updated, not 0. If it says 0 rows, the stored email doesn&apos;t match — use your user ID instead:</p>
              <p className="mu" style={{ wordBreak: "break-all" }}><code>update public.profiles set is_admin = true where user_id = &apos;{user.id}&apos;;</code></p>
              <button className="btn sec" disabled={checking} onClick={async () => { setChecking(true); try { await refreshMod?.(); } catch {} setChecking(false); }}>
                {checking ? "Checking…" : "I've run it — check again"}
              </button>
            </div>
          ) : null}
          <button className="btn sec" onClick={onExit}>← Back to Steady</button>
          {confirmSignOut ? (
            <div className="card" style={{ marginTop: 8 }}>
              <b>Log out?</b>
              <p className="mu">You can log back in anytime with the same account.</p>
              <button className="btn" onClick={onSignOut}>Log out</button>
              <button className="btn sec" style={{ marginTop: 8 }} onClick={() => setConfirmSignOut(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn sec" style={{ marginTop: 8 }} onClick={() => setConfirmSignOut(true)}>Sign out</button>
          )}
        </div>
      </div>
    );
  }
  const page = path === "/" || path === "" ? "dash" : path.slice(1);
  return (
    <div className="in">
      <div className="row">
        <h1>Steady Admin</h1>
        <button className="chip" onClick={onExit}>← App</button>
      </div>
      <p className="mu">Signed in as {user.email}</p>
      <div className="adm-nav">
        {NAV.map(([p, label]) => (
          <a key={p} className={"chip " + ((page === "dash" ? "/" : "/" + page) === p ? "on" : "")} style={{ textDecoration: "none" }} href={"#/admin" + p}>{label}</a>
        ))}
      </div>
      {page === "dash" && <DashboardPage />}
      {page === "reports" && <ReportsPage adminId={user.id} />}
      {page === "posts" && <PostsPage adminId={user.id} />}
      {page === "users" && <UsersPage adminId={user.id} />}
      {page === "history" && <HistoryPage />}
      {!(["dash", "reports", "posts", "users", "history"].includes(page)) && <p className="mu">That admin page doesn&apos;t exist. Pick one above.</p>}
    </div>
  );
}

function Stat({ n, label }) {
  return <div className="card stat"><b>{n}</b><span className="mu">{label}</span></div>;
}

function DashboardPage() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const a = supabase();
        const q = (t, col, v) => a.from(t).select(col, { count: "exact", head: true }).eq(col, v).then((r) => {
          if (r.error) throw r.error;
          return r.count ?? 0;
        });
        const [pending, resolved, users, suspended, banned, removed] = await Promise.all([
          q("reports", "status", "pending"),
          q("reports", "status", "resolved"),
          a.from("profiles").select("user_id", { count: "exact", head: true }).then((r) => { if (r.error) throw r.error; return r.count ?? 0; }),
          q("profiles", "status", "suspended"),
          q("profiles", "status", "banned"),
          q("posts", "status", "removed"),
        ]);
        setS({ pending, resolved, users, suspended, banned, removed });
      } catch (e) { setErr(dbErr(e)); }
    })();
  }, []);
  if (err) return <div className="card"><b>Dashboard unavailable</b><p className="mu">{err}</p></div>;
  if (!s) return <p className="mu">Loading…</p>;
  return (
    <div className="grid">
      <Stat n={s.pending} label="Pending reports" />
      <Stat n={s.resolved} label="Reports resolved" />
      <Stat n={s.users} label="Total users" />
      <Stat n={s.suspended} label="Suspended" />
      <Stat n={s.banned} label="Banned" />
      <Stat n={s.removed} label="Removed posts" />
    </div>
  );
}

const RSTATUSES = ["all", "pending", "reviewed", "resolved", "dismissed"];
const RTYPES = ["all", "post", "user"];

function Pill({ v }) {
  const cls = v === "pending" || v === "suspended" || v === "hidden" ? "warn"
    : v === "banned" || v === "removed" ? "bad"
    : v === "active" || v === "resolved" ? "ok" : "mut";
  return <span className={"pill " + cls}>{v}</span>;
}

async function fetchProfiles(ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map();
  const a = supabase();
  const { data, error } = await a.from("profiles").select("user_id,email,display_name,avatar_url,bio,is_admin,status,warned_count").in("user_id", uniq);
  if (error) throw error;
  return new Map((data || []).map((p) => [p.user_id, p]));
}

function ReportsPage({ adminId }) {
  const [reports, setReports] = useState([]);
  const [names, setNames] = useState(new Map());
  const [fs, setFs] = useState("all");
  const [ft, setFt] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    setErr("");
    try {
      const a = supabase();
      const { data, error } = await a.from("reports").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      setReports(data || []);
      setNames(await fetchProfiles((data || []).flatMap((r) => [r.reporter_id, r.reported_user_id])));
    } catch (e) { setErr(dbErr(e)); }
  };
  useEffect(() => { load(); }, []);

  const open = async (r) => {
    setOpenId(r.id);
    setDetail(null);
    setMsg("");
    try {
      const a = supabase();
      let post = null, author = null;
      if (r.reported_post_id) {
        const pr = await a.from("posts").select("*").eq("id", r.reported_post_id).maybeSingle();
        if (pr.error) throw pr.error;
        post = pr.data;
        if (post) {
          const mp = await fetchProfiles([post.user_id]);
          author = mp.get(post.user_id) || null;
        }
      }
      let subject = null;
      if (r.reported_user_id) subject = (await fetchProfiles([r.reported_user_id])).get(r.reported_user_id) || null;
      setDetail({ post, author, subject });
    } catch (e) { setErr(dbErr(e)); }
  };

  const act = async (fn, okMsg) => {
    setMsg("");
    setErr("");
    try {
      const warn = await fn();
      setMsg(okMsg + (warn ? ` (audit warning: ${warn})` : ""));
      await load();
      if (openId) {
        const r = reports.find((x) => x.id === openId);
        if (r) await open({ ...r });
      }
    } catch (e) { setErr(dbErr(e)); }
  };

  const setStatus = (r, status) => act(async () => {
    const { error } = await supabase().from("reports").update({ status }).eq("id", r.id);
    if (error) throw error;
    return logAudit(adminId, "report.status", "report", r.id, r.status, status);
  }, `Report marked ${status}.`);

  const postAction = (r, post, status) => act(async () => {
    const prev = post.status;
    const { error } = await supabase().from("posts").update({ status }).eq("id", post.id);
    if (error) throw error;
    let warn = await logAudit(adminId, `post.${status}`, "post", post.id, prev, status);
    if (status === "removed") {
      const rr = await supabase().from("reports").update({ status: "resolved" }).eq("reported_post_id", post.id).eq("status", "pending");
      if (rr.error) warn = warn || dbErr(rr.error);
    }
    return warn;
  }, `Post ${status}.`);

  const userAction = (targetId, action, patch) => act(async () => {
    if (targetId === adminId) throw new Error("You can't moderate your own account.");
    const before = names.get(targetId);
    const prev = before ? before.status : "?";
    const { error } = action === "warn"
      ? await supabase().from("profiles").update({ warned_count: (before?.warned_count ?? 0) + 1 }).eq("user_id", targetId)
      : await supabase().from("profiles").update(patch).eq("user_id", targetId);
    if (error) throw error;
    let warn = await logAudit(adminId, `user.${action}`, "user", targetId, action === "warn" ? `warned×${before?.warned_count ?? 0}` : prev, action === "warn" ? `warned×${(before?.warned_count ?? 0) + 1}` : patch.status);
    if (action === "suspended" || action === "banned") {
      const rr = await supabase().from("reports").update({ status: "resolved" }).eq("reported_user_id", targetId).eq("status", "pending");
      if (rr.error) warn = warn || dbErr(rr.error);
    }
    return warn;
  }, `User ${action}.`);

  const list = reports.filter((r) =>
    (fs === "all" || r.status === fs) &&
    (ft === "all" || r.type === ft) &&
    (!q || r.id.toLowerCase().includes(q.toLowerCase()) || (r.reason || "").toLowerCase().includes(q.toLowerCase()))
  );

  const modName = (id) => names.get(id)?.display_name || (id ? id.slice(0, 8) + "…" : "guest");

  return (
    <>
      {err && <div className="card"><b>Error</b><p className="mu">{err}</p></div>}
      {msg && <p style={{ color: "var(--ac)", fontSize: 14, fontWeight: 600 }}>{msg}</p>}
      <p className="mu">Status</p>
      <Chips options={RSTATUSES} value={fs} onPick={(x) => { setFs(x); setOpenId(null); }} />
      <p className="mu" style={{ marginTop: 12 }}>Type</p>
      <Chips options={RTYPES} value={ft} onPick={(x) => { setFt(x); setOpenId(null); }} />
      <input placeholder="Search by report ID or reason" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginTop: 12 }} />
      <p className="mu">{list.length} of {reports.length} reports</p>
      {list.map((r) => (
        <div className="card" key={r.id}>
          <div className="row">
            <span><b>{r.type}</b> · <span className="mu">{r.id.slice(0, 8)}…</span></span>
            <Pill v={r.status} />
          </div>
          <p style={{ margin: "6px 0" }}>{r.reason}</p>
          <p className="mu" style={{ margin: 0 }}>
            Reported {r.type === "post" ? (r.reported_display_name || "a post") : modName(r.reported_user_id)} ·
            by {r.reporter_id ? modName(r.reporter_id) : <span className="pill mut">guest</span>} · {new Date(r.created_at).toLocaleString()}
          </p>
          <button className="btn sec" style={{ marginTop: 8 }} onClick={() => (openId === r.id ? setOpenId(null) : open(r))}>
            {openId === r.id ? "Close" : "Open report"}
          </button>
          {openId === r.id && (
            <ReportDetail
              r={r} detail={detail} modName={modName}
              onStatus={(s) => setStatus(r, s)}
              onPost={(p, s) => postAction(r, p, s)}
              onUser={(id, a, p) => userAction(id, a, p)}
            />
          )}
        </div>
      ))}
      {!list.length && !err && <p className="mu">No reports match.</p>}
    </>
  );
}

function ReportDetail({ r, detail, modName, onStatus, onPost, onUser }) {
  if (!detail) return <p className="mu">Loading context…</p>;
  const { post, author, subject } = detail;
  const authorId = r.reported_user_id || post?.user_id || null;
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <p className="mu">Report ID: {r.id}</p>
      {r.type === "post" && (
        post ? (
          <div className="card">
            <div className="row"><b>{post.display_name || "Member"}</b><Pill v={post.status} /></div>
            <p>{post.body}</p>
            <p className="mu" style={{ margin: 0 }}>{new Date(post.created_at).toLocaleString()} · {post.stage} · {post.visibility}</p>
            <div className="row" style={{ marginTop: 8 }}>
              <span>
                <button className="chip" onClick={() => onPost(post, "hidden")}>Hide</button>{" "}
                <button className="chip" onClick={() => onPost(post, "removed")}>Remove</button>{" "}
                <button className="chip" onClick={() => onPost(post, "active")}>Restore</button>
              </span>
            </div>
          </div>
        ) : <p className="mu">Reported post no longer exists. Snapshot: {r.reported_body || "—"}</p>
      )}
      {authorId && (
        <p className="mu">
          Author: {author?.display_name || subject?.display_name || modName(authorId)}
          {author && <> · status <Pill v={author.status} /> · warns {author.warned_count}</>}
        </p>
      )}
      {authorId && (
        <div className="row">
          <span>
            <button className="chip" onClick={() => onUser(authorId, "warn")}>Warn</button>{" "}
            <button className="chip" onClick={() => onUser(authorId, "suspended", { status: "suspended" })}>Suspend</button>{" "}
            <button className="chip" onClick={() => onUser(authorId, "banned", { status: "banned" })}>Ban</button>{" "}
            <button className="chip" onClick={() => onUser(authorId, "restored", { status: "active" })}>Restore</button>
          </span>
        </div>
      )}
      <p className="mu" style={{ marginTop: 12 }}>Set report status</p>
      <div className="row">
        <span>
          {["reviewed", "resolved", "dismissed"].map((s) => (
            <span key={s}><button className="chip" onClick={() => onStatus(s)}>Mark {s}</button>{" "}</span>
          ))}
        </span>
      </div>
    </div>
  );
}

function PostsPage({ adminId }) {
  const [id, setId] = useState("");
  const [found, setFound] = useState(null);
  const [browse, setBrowse] = useState([]);
  const [fStatus, setFStatus] = useState("all");
  const [author, setAuthor] = useState(null);
  const [postReports, setPostReports] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const loadBrowse = async (status) => {
    try {
      let q = supabase().from("posts").select("*").order("created_at", { ascending: false }).limit(50);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      setBrowse(data || []);
    } catch (e) { setErr(dbErr(e)); }
  };
  useEffect(() => { loadBrowse(fStatus); }, [fStatus]);

  const lookup = async () => {
    setErr(""); setMsg(""); setFound(null); setAuthor(null); setPostReports([]);
    try {
      const { data, error } = await supabase().from("posts").select("*").eq("id", id.trim()).maybeSingle();
      if (error) throw error;
      if (!data) { setErr("No post with that ID. Check the ID and try again."); return; }
      setFound(data);
      const mp = await fetchProfiles([data.user_id]);
      setAuthor(mp.get(data.user_id) || null);
      const rr = await supabase().from("reports").select("*").eq("reported_post_id", data.id).order("created_at", { ascending: false });
      if (!rr.error) setPostReports(rr.data || []);
    } catch (e) { setErr(dbErr(e)); }
  };

  const setStatus = async (p, status) => {
    setErr(""); setMsg("");
    try {
      const prev = p.status;
      const { error } = await supabase().from("posts").update({ status }).eq("id", p.id);
      if (error) throw error;
      const warn = await logAudit(adminId, `post.${status}`, "post", p.id, prev, status);
      setFound((f) => (f && f.id === p.id ? { ...f, status } : f));
      await loadBrowse(fStatus);
      setMsg(`Post ${status}.` + (warn ? ` (audit warning: ${warn})` : ""));
    } catch (e) { setErr(dbErr(e)); }
  };

  const Card = ({ p }) => (
    <div className="card">
      <div className="row"><b>{p.display_name || "Member"}</b><Pill v={p.status} /></div>
      <p>{p.body}</p>
      <p className="mu" style={{ margin: 0 }}>{p.id} · {new Date(p.created_at).toLocaleString()} · {p.visibility}</p>
      <div className="row" style={{ marginTop: 8 }}>
        <span>
          <button className="chip" onClick={() => setStatus(p, "hidden")}>Hide</button>{" "}
          <button className="chip" onClick={() => setStatus(p, "removed")}>Remove</button>{" "}
          <button className="chip" onClick={() => setStatus(p, "active")}>Restore</button>
        </span>
      </div>
    </div>
  );

  return (
    <>
      {err && <div className="card"><b>Error</b><p className="mu">{err}</p></div>}
      {msg && <p style={{ color: "var(--ac)", fontSize: 14, fontWeight: 600 }}>{msg}</p>}
      <div className="row" style={{ gap: 8 }}>
        <input placeholder="Find post by ID" value={id} onChange={(e) => setId(e.target.value)} style={{ flex: 1, margin: 0 }} />
        <button className="chip on" onClick={lookup} style={{ flex: "none" }}>Find</button>
      </div>
      {found && (
        <>
          <h2>Result</h2>
          <Card p={found} />
          {author && <p className="mu">Author: {author.display_name} · status <Pill v={author.status} /></p>}
          {postReports.length > 0 && <p className="mu">{postReports.length} report(s) on this post: {postReports.map((r) => `${r.reason} (${r.status})`).join("; ")}</p>}
        </>
      )}
      <h2>Browse all posts</h2>
      <p className="mu">Status</p>
      <Chips options={["all", "active", "hidden", "removed"]} value={fStatus} onPick={setFStatus} />
      <p className="mu">{browse.length} post(s), newest first</p>
      {browse.map((p) => <Card key={p.id} p={p} />)}
      {!browse.length && !err && <p className="mu">No posts with this status.</p>}
    </>
  );
}

function UsersPage({ adminId }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [posts, setPosts] = useState([]);
  const [raps, setRaps] = useState([]);
  const [byRaps, setByRaps] = useState([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const search = async () => {
    setErr(""); setMsg(""); setSel(null);
    try {
      const a = supabase();
      let res;
      if (/^[0-9a-f-]{8,}/i.test(q.trim())) {
        res = await a.from("profiles").select("*").eq("user_id", q.trim()).limit(5);
      } else {
        res = await a.from("profiles").select("*").ilike("display_name", `%${q.trim()}%`).limit(20);
      }
      if (res.error) throw res.error;
      setList(res.data || []);
      if (!(res.data || []).length) setErr("No users found.");
    } catch (e) { setErr(dbErr(e)); }
  };

  const openUser = async (u) => {
    setSel(u);
    setMsg("");
    try {
      const a = supabase();
      const [p, ra, rb] = await Promise.all([
        a.from("posts").select("*").eq("user_id", u.user_id).order("created_at", { ascending: false }).limit(20),
        a.from("reports").select("*").eq("reported_user_id", u.user_id).order("created_at", { ascending: false }).limit(20),
        a.from("reports").select("*").eq("reporter_id", u.user_id).order("created_at", { ascending: false }).limit(20),
      ]);
      if (p.error) throw p.error;
      setPosts(p.data || []);
      setRaps(ra.error ? [] : (ra.data || []));
      setByRaps(rb.error ? [] : (rb.data || []));
    } catch (e) { setErr(dbErr(e)); }
  };

  const act = async (action, patch) => {
    setErr(""); setMsg("");
    try {
      if (sel.user_id === adminId) throw new Error("You can't moderate your own account.");
      const { error } = action === "warn"
        ? await supabase().from("profiles").update({ warned_count: (sel.warned_count ?? 0) + 1 }).eq("user_id", sel.user_id)
        : await supabase().from("profiles").update(patch).eq("user_id", sel.user_id);
      if (error) throw error;
      const prev = action === "warn" ? `warned×${sel.warned_count ?? 0}` : sel.status;
      const next = action === "warn" ? `warned×${(sel.warned_count ?? 0) + 1}` : patch.status;
      const warn = await logAudit(adminId, `user.${action}`, "user", sel.user_id, prev, next);
      if (action === "suspended" || action === "banned") {
        await supabase().from("reports").update({ status: "resolved" }).eq("reported_user_id", sel.user_id).eq("status", "pending");
      }
      setSel((s) => action === "warn" ? { ...s, warned_count: (s.warned_count ?? 0) + 1 } : { ...s, ...patch });
      setMsg(`User ${action}.` + (warn ? ` (audit warning: ${warn})` : ""));
    } catch (e) { setErr(e.message === "You can't moderate your own account." ? e.message : dbErr(e)); }
  };

  return (
    <>
      {err && <div className="card"><b>Error</b><p className="mu">{err}</p></div>}
      {msg && <p style={{ color: "var(--ac)", fontSize: 14, fontWeight: 600 }}>{msg}</p>}
      <div className="row" style={{ gap: 8 }}>
        <input placeholder="Search name or user ID" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} style={{ flex: 1, margin: 0 }} />
        <button className="chip on" onClick={search} style={{ flex: "none" }}>Search</button>
      </div>
      {list.map((u) => (
        <div className="card row" key={u.user_id}>
          <span><b>{u.display_name || "Member"}</b> <Pill v={u.status} /> <span className="mu">{u.is_admin ? "admin" : "user"}</span></span>
          <button className="chip" onClick={() => openUser(u)}>Open</button>
        </div>
      ))}
      {sel && (
        <div className="card">
          <div className="row"><b style={{ fontSize: 18 }}>{sel.display_name || "Member"}</b><Pill v={sel.status} /></div>
          <p className="mu" style={{ margin: "4px 0" }}>{sel.user_id} · {sel.email || "no email"} · {sel.is_admin ? "admin" : "user"} · warnings {sel.warned_count ?? 0}</p>
          {sel.bio ? <p>{sel.bio}</p> : null}
          <div className="row">
            <span>
              <button className="chip" onClick={() => act("warn")}>Warn</button>{" "}
              <button className="chip" onClick={() => act("suspended", { status: "suspended" })}>Suspend</button>{" "}
              <button className="chip" onClick={() => act("banned", { status: "banned" })}>Ban</button>{" "}
              <button className="chip" onClick={() => act("restored", { status: "active" })}>Restore</button>
            </span>
          </div>
          <h2>Posts ({posts.length})</h2>
          {posts.map((p) => (
            <div className="card" key={p.id}>
              <div className="row"><span className="mu">{new Date(p.created_at).toLocaleDateString()} · {p.visibility}</span><Pill v={p.status} /></div>
              <p style={{ margin: "4px 0 0" }}>{p.body}</p>
            </div>
          ))}
          {!posts.length && <p className="mu">No posts.</p>}
          <h2>Reports against ({raps.length})</h2>
          {raps.map((r) => <p className="mu" key={r.id}>· {r.reason} — {r.status} ({new Date(r.created_at).toLocaleDateString()})</p>)}
          {!raps.length && <p className="mu">None.</p>}
          <h2>Reports filed ({byRaps.length})</h2>
          {byRaps.map((r) => <p className="mu" key={r.id}>· {r.type}: {r.reason} — {r.status}</p>)}
          {!byRaps.length && <p className="mu">None.</p>}
        </div>
      )}
    </>
  );
}

function HistoryPage() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase().from("moderation_log").select("*").order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        setRows(data || []);
      } catch (e) { setErr(dbErr(e)); }
    })();
  }, []);
  if (err) return <div className="card"><b>Error</b><p className="mu">{err}</p></div>;
  if (!rows) return <p className="mu">Loading…</p>;
  if (!rows.length) return <p className="mu">No admin actions yet. Actions you take will appear here.</p>;
  return (
    <>
      {rows.map((r) => (
        <div className="card" key={r.id}>
          <p style={{ margin: 0 }}><b>{r.action}</b> · {r.target_type} {String(r.target_id).slice(0, 13)}</p>
          <p className="mu" style={{ margin: "4px 0 0" }}>
            by {String(r.admin_id).slice(0, 8)}… · {r.prev_state ?? "—"} → {r.new_state ?? "—"} · {new Date(r.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </>
  );
}
