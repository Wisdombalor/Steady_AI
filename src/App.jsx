import { useCallback, useEffect, useRef, useState } from "react";
import { CO, MOT } from "./lib/data";
import { useSteadyStore, freshStore, migrate } from "./lib/store";
import { supabase, loadPosts, sendReport, insertPost, getModState, syncProfile } from "./lib/backend";
import { AdminApp } from "./components/Admin";
import { aerr, daysSince } from "./lib/helpers";
import { Nav, Sheet, Modal } from "./components/Chrome";
import { Onboarding, Login, Signup } from "./components/Onboarding";
import { GoogleIcon } from "./components/Icons";
import { Home } from "./components/Home";
import { Recovery } from "./components/Recovery";
import { Community } from "./components/Community";
import { Support, Protect } from "./components/Support";
import { Profile } from "./components/Profile";
import {
  UrgeSheet, HubSheet, ActsSheet, CallSheet, TrustSheet, RulesSheet, PostSheet,
  FiltersSheet, DeleteSheet, ReportSheet, RequestSheet, RelapseSheet, WipeSheet,
  CheckSheet, SelfCheckSheet, SelfResult, ReassessSheet, ReassessResult, AiSheet, SetPwSheet,
  ProfileSheet, ConfirmSheet,
} from "./components/Sheets";

function stageFor(days) {
  return days < 1 ? "Starting out" : days <= 7 ? "1–7 days" : days <= 30 ? "8–30 days"
    : days <= 90 ? "31–90 days" : days <= 180 ? "3–6 months" : days <= 365 ? "6–12 months" : "1+ year";
}

export default function App() {
  const [user, setUser] = useState(null);
  const pushTimer = useRef(null);
  const queuePush = useCallback(() => {
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      try {
        if (!supabase) return;
        // user read from ref below
      } catch {}
    }, 1500);
  }, []);

  const [store, update, resetStore, replaceAll] = useSteadyStore(user, queuePush);
  const storeRef = useRef(store);
  storeRef.current = store;
  const userRef = useRef(user);
  userRef.current = user;

  const doPush = useCallback(async () => {
    const u = userRef.current, s = storeRef.current;
    if (!u) return;
    try {
      const a = supabase();
      const { posts, outbox, ...rest } = s;
      await a.from("user_data").upsert({ user_id: u.id, data: rest, updated_at: new Date().toISOString() });
    } catch {}
  }, []);

  useEffect(() => {
    clearTimeout(pushTimer.current);
    if (user) pushTimer.current = setTimeout(doPush, 1500);
  }, [store, user, doPush]);

  const [tab, setTab] = useState("home");
  const [ob, setOb] = useState(0);
  const [authMode, setAuthMode] = useState("start");
  // Status of a just-completed OAuth redirect (shown on the landing page).
  const [oauthNote, setOauthNote] = useState(null);
  // Session restore state: gates the launch splash below.
  const [authReady, setAuthReady] = useState(false);
  // Full-screen signing-in veil: true from first paint when we land back
  // from Google (?code=...), cleared once the session is processed.
  const [oauthBusy, setOauthBusy] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      return q.has("code") && !q.has("error");
    } catch { return false; }
  });
  const [sheet, setSheet] = useState(null);
  const [modal, setModal] = useState(null);
  const [filters, setFilters] = useState({ time: "all", stage: "all" });
  const [urgeDraft, setUrgeDraft] = useState(null);
  const [actIndex, setActIndex] = useState(0);
  const [actDone, setActDone] = useState(0);
  const [reassessLevel, setReassessLevel] = useState(null);
  const [selfScore, setSelfScore] = useState(null);
  const [selfFromOnboarding, setSelfFromOnboarding] = useState(false);
  const [mod, setMod] = useState({ role: "user", status: "active" });
  const [hash, setHash] = useState(() => window.location.hash || "#/");

  useEffect(() => {
    const f = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);

  // Own moderation state (role + status). Fails open to plain user so the
  // app keeps working pre-migration; the admin gate requires role === admin.
  useEffect(() => {
    if (!user) { setMod({ role: "user", status: "active" }); return; }
    getModState(user.id).then(setMod).catch(() => setMod({ role: "user", status: "active" }));
  }, [user]);

  const suspended = !!user && mod.status !== "active";

  const refreshMod = useCallback(async () => {
    try {
      const id = userRef.current?.id;
      if (!id) return;
      setMod(await getModState(id));
    } catch {}
  }, []);

  const close = useCallback(() => setSheet(null), []);
  const open = useCallback((name, payload) => {
    if (name === "protect") { setSheet(null); setTab("prot"); return; }
    setSheet({ name, payload });
  }, []);
  // Auth-form navigation inside sheets: Back closes, links swap between login/signup.
  const sheetAuthMode = useCallback((m) => {
    if (m === "start") setSheet(null);
    else if (m === "login") setSheet({ name: "login" });
    else if (m === "signup") setSheet({ name: "signup" });
  }, []);
  const goTab = useCallback((v) => { setSheet(null); setTab(v); }, []);

  const refreshPosts = useCallback(async () => {
    try {
      const remote = await loadPosts(userRef.current);
      const local = storeRef.current.posts.filter((x) => String(x.id).startsWith("p"));
      const merged = [...remote, ...local];
      update({ posts: merged });
    } catch {}
  }, [update]);

  useEffect(() => { if (tab === "com") refreshPosts(); }, [tab, refreshPosts]);

  // flush outbox
  useEffect(() => {
    if (!store.outbox.length || !store.done) return;
    const q = [...store.outbox];
    update({ outbox: [] });
    (async () => {
      for (const o of q) {
        try {
          await sendReport(o.subject, o.f, (queued) =>
            update((prev) => ({ outbox: [...prev.outbox, queued] }))
          );
        } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.done]);

  // Track the session for the life of the app so refreshes, restores and
  // token refreshes keep the user signed in (persisted by supabase-js).
  // authReady flips on the first auth event (or a safety timeout) so a
  // returning account holder never sees onboarding flash before restore.
  useEffect(() => {
    let sub = null;
    const readyTimer = setTimeout(() => setAuthReady(true), 6000);
    (async () => {
      try {
        const a = supabase();
        const { data } = a.auth.onAuthStateChange(async (ev, session) => {
          setAuthReady(true);
          if (ev === "PASSWORD_RECOVERY") { open("setpw"); return; }
          if (ev === "SIGNED_OUT") { setUser(null); return; }
          if (session?.user) {
            // Fresh sign-ins navigate home; silent token refreshes must not
            // yank the user out of what they're doing.
            await handleUser(session.user, ev !== "TOKEN_REFRESHED");
          } else if (ev === "INITIAL_SESSION") {
            refreshPosts();
          }
        });
        sub = data?.subscription;
        // Google redirect lands back here with ?code=... (or ?error=...).
        // supabase-js exchanges the code itself (detectSessionInUrl); we only
        // watch for the resulting session so a failure shows a message on the
        // landing page instead of silently stranding the user there. Never
        // exchange explicitly here: a second exchange burns the single-use
        // code and fails the login ("Unable to exchange external code").
        const q = new URLSearchParams(window.location.search);
        if (q.has("code") || q.has("error") || q.has("error_description")) {
          const cleanUrl = () => {
            try { window.history.replaceState(null, "", window.location.pathname + window.location.hash); } catch {}
          };
          if (q.get("error")) {
            // "Unable to exchange external code" means Google refused the
            // handoff at Supabase's callback (redirect URI / client secret
            // misconfigured) — retrying can't fix that, so say so plainly.
            const desc = q.get("error_description") || q.get("error") || "";
            const cfg = /exchange external code|invalid client|redirect_?uri/i.test(desc);
            setOauthNote({ kind: "error", text: cfg
              ? "Google couldn't complete the handoff. The app owner needs to check the Google sign-in configuration (redirect URI + client secret in Supabase)."
              : "Google sign-in didn't complete (" + desc + "). Please try again." });
            cleanUrl();
          } else {
            setOauthNote({ kind: "pending", text: "Completing Google sign-in…" });
            let done = false;
            for (let i = 0; i < 20 && !done; i++) {
              try {
                const { data: s } = await a.auth.getSession();
                if (s?.session?.user) {
                  await handleUser(s.session.user, true);
                  setOauthNote(null);
                  done = true;
                }
              } catch {}
              if (!done) await new Promise((r) => setTimeout(r, 500));
            }
            if (!done) {
              setOauthNote({ kind: "error", text: "Google sign-in didn't complete. The link may have expired — please try again." });
            }
            setOauthBusy(false);
            cleanUrl();
          }
        }
      } catch {}
    })();
    return () => { clearTimeout(readyTimer); try { sub?.unsubscribe(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUser = async (u, fresh = true) => {
    setUser(u);
    try {
      const a = supabase();
      const r = await a.from("user_data").select("data").maybeSingle();
      const d = r.data?.data;
      if (d && d.done) {
        const keep = { posts: storeRef.current.posts, outbox: storeRef.current.outbox };
        const next = migrate({ ...freshStore(), ...d, ...keep, checks: d.checks || [] });
        replaceAll(next);
        if (!next.done) setOb(1);
      } else if (storeRef.current.done) doPush();
    } catch {}
    try {
      const remote = await loadPosts(u);
      const local = storeRef.current.posts.filter((x) => String(x.id).startsWith("p"));
      update({ posts: [...remote, ...local] });
    } catch {}
    const meta = u.user_metadata || {};
    const email = u.email || "";
    // Google accounts don't always expose a name; fall back to the email
    // prefix so OAuth users are never stranded on the landing page.
    const displayName = meta.name || meta.full_name || storeRef.current.name || email.split("@")[0] || "";
    const n = displayName.trim();
    update({ email });
    if (n.length < 2) { setAuthMode("start"); return; }
    update({ name: n });
    try {
      const s = storeRef.current;
      await syncProfile(u, { displayName: n, avatarUrl: s.avatar, bio: s.bio });
    } catch {}
    // Independent lookup: a profile-sync hiccup must never block the role check.
    try {
      setMod(await getModState(u.id));
    } catch {}
    if (!fresh) return;
    if (storeRef.current.done) { close(); setTab("home"); }
    else setOb(1);
  };

  const onAuth = async (cmd) => {
    try {
      const a = supabase();
      if (cmd.nextOb !== undefined) { setOb(cmd.nextOb); return null; }
      if (cmd.sheet === "selfcheck") { setSelfFromOnboarding(true); open("selfcheck"); return null; }
      if (cmd.provider === "google") {
        if (cmd.country) update({ country: cmd.country });
        const r = await a.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
        if (r.error) throw r.error;
        return null;
      }
      if (cmd.signup) {
        update({ name: cmd.signup.name });
        const r = await a.auth.signUp({
          email: cmd.signup.email,
          password: cmd.signup.password,
          options: { data: { name: cmd.signup.name }, emailRedirectTo: location.origin + location.pathname },
        });
        if (r.error) throw r.error;
        if (r.data.session) await handleUser(r.data.session.user);
        else return "UNCONFIRMED:" + cmd.signup.email;
      }
      if (cmd.login) {
        try {
          const r = await a.auth.signInWithPassword({ email: cmd.login.email, password: cmd.login.password });
          if (r.error) throw r.error;
          await handleUser(r.data.user);
        } catch (e) {
          if (/not confirmed|email not confirmed/i.test(e?.message || "")) return "UNCONFIRMED:" + cmd.login.email;
          throw e;
        }
        return null;
      }
      if (cmd.resend) {
        const r = await a.auth.resend({
          type: "signup",
          email: cmd.resend,
          options: { emailRedirectTo: location.origin + location.pathname },
        });
        if (r.error) throw r.error;
        return "Activation link sent. Check your inbox (and spam), then log in.";
      }
      if (cmd.reset) {
        const r = await a.auth.resetPasswordForEmail(cmd.reset, { redirectTo: location.origin + location.pathname });
        if (r.error) throw r.error;
        return "If an account exists for that email, a reset link is on its way.";
      }
    } catch (e) {
      if (cmd.signup && /already registered|already exists|already been registered/i.test(e?.message || "")) {
        return "EXISTS:" + cmd.signup.email;
      }
      return aerr(e);
    }
    return null;
  };

  const onFinishOnboarding = () => {
    update({ done: 1 });
    close();
    setTab("home");
    setModal({ name: storeRef.current.name, quote: MOT[Math.floor(Math.random() * MOT.length)] });
  };

  const actions = {
    open, close, goTab,
    nextOb: () => { close(); setSelfFromOnboarding(false); setOb(2); },
    logout: async () => {
      try { await supabase().auth.signOut(); } catch {}
      setUser(null);
    resetStore();
      setTab("home"); setOb(0); setAuthMode("start");
    },
  };

  // Log the urge the moment it starts, so it is never lost if the sheet is dismissed.
  // Slider/trigger/feeling picks patch the stored record live by id.
  const startUrge = () => {
    const t = Date.now();
    const rec = { t, before: 5, after: null, trigs: [], emos: [] };
    update((prev) => ({ urges: [...prev.urges, rec] }));
    setUrgeDraft({ id: t, before: 5, trigs: [], emos: [] });
    setActDone(0);
    open("urge");
  };
  const setUrgeDraftLive = (nd) => {
    const full = typeof nd === "function" ? nd(urgeDraft) : nd;
    setUrgeDraft(full);
    if (full?.id != null) {
      update((prev) => ({
        urges: prev.urges.map((u) =>
          u.t === full.id ? { ...u, before: full.before, trigs: full.trigs ?? [], emos: full.emos ?? [] } : u
        ),
      }));
    }
  };
  const continueUrge = () => { open("hub"); };

  const completeAct = () => {
    const done = actDone + 1;
    setActDone(done);
    setActIndex((i) => i + 1);
    if (done % 3 === 0) open("reassess");
  };

  const pickReassess = (level) => {
    const id = urgeDraft?.id;
    if (id != null) {
      const rec = store.urges.find((u) => u.t === id);
      const before = rec?.before ?? urgeDraft?.before ?? 5;
      let after;
      if (level === 0) after = 0;
      else if (level === 1) after = Math.max(1, before - 2);
      else if (level === 2) after = before;
      else after = Math.min(10, before + 1);
      update((prev) => ({
        urges: prev.urges.map((u) => (u.t === id ? { ...u, after } : u)),
      }));
    }
    setReassessLevel(level);
    open("reassessResult");
  };

  const newPeriod = () => {
    if (store.start) update({ periods: [...store.periods, { days: daysSince(store.start) }], start: Date.now() });
    else update({ start: Date.now() });
    open("protect");
  };

  const submitPost = async (text, visibility) => {
    if (suspended) return "Your account is suspended, so you can't post right now.";
    const d = daysSince(store.start);
    const stage = stageFor(d);
    const localSave = () => {
      update({ posts: [{ id: "p" + Date.now(), t: text, v: "me", mine: 1, d: Date.now(), stage }, ...store.posts] });
    };
    if (user) {
      try {
        const a = supabase();
        await insertPost(a, {
          user_id: user.id,
          body: text, visibility: visibility === "me" ? "private" : visibility === "anon" ? "anon" : "community",
          stage, display_name: store.name,
          _av: store.avatar || null, _bio: store.bio || null, _days: daysSince(store.start),
        });
        await refreshPosts();
      } catch (e) {
        const missing = /Could not find the table|schema cache|PGRST205/i.test(String(e?.message || ""));
        if (missing && visibility === "me") {
          // Private posts don't need the server: keep them on-device.
          localSave();
        } else if (missing) {
          return "Community posting needs the database set up — ask the app owner to run the Supabase migration.";
        } else {
          return "Couldn't post right now. Please try again.";
        }
      }
    } else {
      localSave();
    }
    close();
    return null;
  };

  // Switch an own post between Only me, Anonymous and Public.
  // Returns an error string, or null on success.
  const setPostVisibility = async (post, visibility) => {
    const v = visibility === "me" ? "me" : visibility === "com" ? "com" : "anon";
    update((prev) => ({ posts: prev.posts.map((p) => (p.id === post.id ? { ...p, v } : p)) }));
    if (user && !String(post.id).startsWith("p")) {
      try {
        const { error } = await supabase().from("posts").update({ visibility: v === "me" ? "private" : v === "com" ? "community" : "anon" }).eq("id", post.id);
        if (error) throw error;
        await refreshPosts();
      } catch (e) {
        update((prev) => ({ posts: prev.posts.map((p) => (p.id === post.id ? { ...p, v: post.v } : p)) }));
        const m = String(e?.message || "");
        if (/Could not find the table|schema cache|PGRST205/i.test(m)) return "Visibility needs the database migration to sync — it's updated on this device for now.";
        if (/row-level security|policy|permission|42501/i.test(m)) return "Your account isn't allowed to change that.";
        return "Couldn't change visibility. Try again.";
      }
    }
    return null;
  };

  const deletePost = async (post) => {
    update({ posts: store.posts.filter((x) => x.id !== post.id) });
    close();
    if (user && post.mine && !String(post.id).startsWith("p")) {
      try { await supabase().from("posts").delete().eq("id", post.id); } catch {}
    }
  };

  const wipeAll = async () => {
    if (user) {
      try {
        const a = supabase();
        await a.from("user_data").delete().eq("user_id", user.id);
        await a.from("posts").delete().eq("user_id", user.id);
      } catch {}
      setUser(null);
    }
    resetStore();
    setFilters({ time: "all", stage: "all" });
    setTab("home"); setOb(0); setAuthMode("start"); close();
  };

  // Full-screen signing-in state while a Google redirect is processed.
  const veil = oauthBusy ? (
    <div className="oauth-veil">
      <div className="oauth-box">
        <span className="tdots" aria-label="Completing sign-in"><i /><i /><i /></span>
        <h2>Completing Google sign-in…</h2>
        <p className="mu">This takes a few seconds.</p>
      </div>
    </div>
  ) : null;

  if (!store.done) {
    // While the session is still resolving, show a launch splash instead of
    // onboarding: an account holder with synced progress goes straight home
    // once restore lands, never flashing setup screens first.
    if (!authReady && !oauthBusy) {
      return (
        <div id="app">
          <div className="oauth-veil">
            <div className="oauth-box">
              <span className="tdots" aria-label="Loading"><i /><i /><i /></span>
              <h2>Loading Steady…</h2>
            </div>
          </div>
          <main id="main" />
          <nav id="nav" />
        </div>
      );
    }
    return (
      <div id="app">
        {veil}
        <main id="main">
          <Onboarding store={store} update={update} ob={ob} setOb={setOb} authMode={authMode} setAuthMode={setAuthMode}
            onFinish={onFinishOnboarding} onAuth={onAuth} notice={oauthNote} />
        </main>
        <nav id="nav" />
        <Sheet open={!!sheet} onClose={close}>
          {sheet?.name === "selfcheck" && <SelfCheckSheet onDone={(score) => { update({ test: score }); setSelfScore(score); open("selfresult"); }} />}
          {sheet?.name === "selfresult" && <SelfResult score={selfScore} done={store.done} actions={actions} />}
          {sheet?.name === "setpw" && <SetPwSheet onSave={async (v) => {
            try {
              const r = await supabase().auth.updateUser({ password: v });
              if (r.error) throw r.error;
              open("donePw");
              return null;
            } catch (e) { return aerr(e); }
          }} />}
          {sheet?.name === "donePw" && <><h2>Password updated</h2><button className="btn" onClick={close}>Done</button></>}
        </Sheet>
        <Modal data={modal} onClose={() => setModal(null)} />
      </div>
    );
  }

  // Dedicated admin route (#/admin). Guarded inside AdminApp; the backend
  // enforces admin rights independently via RLS on every query.
  const adminPath = hash.startsWith("#/admin") ? (hash.slice("#/admin".length) || "/") : null;
  if (adminPath != null) {
    return (
      <div id="app">
        {veil}
        <main id="main">
          <AdminApp
            user={user} mod={mod} path={adminPath} store={store} update={update}
            onAuth={onAuth} authMode={authMode} setAuthMode={setAuthMode}
            onExit={() => { window.location.hash = "#/"; }}
            onSignOut={actions.logout}
            refreshMod={refreshMod}
          />
        </main>
        <nav id="nav" />
      </div>
    );
  }

  // Suspended/banned accounts are stopped here; the database (RLS) blocks
  // their writes independently so bypassing this screen achieves nothing.
  if (suspended) {
    const banned = mod.status === "banned";
    return (
      <div id="app">
        {veil}
        <main id="main">
          <div className="ob in">
            <h1>{banned ? "Account deactivated" : "Account suspended"}</h1>
            <p className="mu">
              {banned
                ? "This account has been deactivated by the Steady team and can no longer use community features."
                : "This account has been temporarily suspended and can't post or file reports right now."}{" "}
              Your private recovery data on this device is untouched.
            </p>
            <p className="mu">If you think this is a mistake, contact Steady Support from the login screen or reply to any email from the team.</p>
            <button className="btn sec" onClick={() => open("confirmLogout")}>Sign out</button>
          </div>
        </main>
        <nav id="nav" />
        <Sheet open={sheet?.name === "confirmLogout"} onClose={close}>
          <ConfirmSheet
            title="Log out?"
            body="You can log back in anytime with the same account."
            confirmLabel="Log out"
            onConfirm={() => { close(); actions.logout(); }}
            onCancel={close}
          />
        </Sheet>
      </div>
    );
  }

  const sheetActions = {
    ...actions,
    open: (name, payload) => {
      // Every path that opens the urge sheet must create a draft + log the urge,
      // otherwise the sheet renders with nothing to save to.
      if (name === "urge") { startUrge(); return; }
      if (name === "acts" && sheet?.name !== "acts") { /* keep index */ }
      open(name, payload);
    },
  };

  return (
    <div id="app">
      {veil}
      <main id="main">
        {tab === "home" && <Home store={store} actions={sheetActions} />}
        {tab === "rec" && <Recovery store={store} actions={sheetActions} />}
        {tab === "com" && <Community store={store} filters={filters} setFilters={setFilters} onOpen={open} user={user} actions={sheetActions} onVisibility={setPostVisibility} />}
        {tab === "sup" && <Support store={store} update={update} actions={sheetActions} />}
        {tab === "prot" && <Protect store={store} onBack={() => goTab("sup")} />}
        {tab === "pro" && <Profile store={store} update={update} actions={actions} authed={!!user} userId={user?.id} />}
      </main>
      <Nav
        tab={tab === "prot" ? "sup" : tab}
        onTab={(v) => { goTab(v); if (v === "com") refreshPosts(); }}
        me={{ loggedIn: !!user, name: store.name, email: store.email, avatar: store.avatar }}
        onProfile={() => goTab("pro")}
        onLogin={() => open("login")}
        onSignup={() => open("signup")}
      />

      <Sheet open={!!sheet} onClose={close}>
        {sheet?.name === "urge" && urgeDraft && <UrgeSheet draft={urgeDraft} setDraft={setUrgeDraftLive} onContinue={continueUrge} onLogOnly={close} logged={store.urges.find((u) => u.t === urgeDraft.id)} />}
        {sheet?.name === "hub" && <HubSheet actions={sheetActions} />}
        {sheet?.name === "acts" && <ActsSheet actIndex={actIndex} onDone={completeAct} onSkip={() => setActIndex((i) => i + 1)} onStop={close} />}
        {sheet?.name === "call" && <CallSheet store={store} actions={sheetActions} />}
        {sheet?.name === "trust" && <TrustSheet store={store} update={update} actions={sheetActions} editIndex={sheet.payload?.index} />}
        {sheet?.name === "delTrust" && (
          <DeleteSheet
            title="Remove this person?"
            onConfirm={() => { update((prev) => ({ trusted: prev.trusted.filter((_, i) => i !== sheet.payload?.index) })); close(); }}
            onCancel={close}
          />
        )}
        {sheet?.name === "post" && (store.rules
          ? <PostSheet store={store} user={user} onPost={submitPost} actions={sheetActions} />
          : <RulesSheet onAgree={() => { update({ rules: 1 }); open("post"); }} />)}
        {sheet?.name === "filters" && <FiltersSheet filters={filters} setFilters={setFilters} onApply={close} />}
        {sheet?.name === "del" && <DeleteSheet onConfirm={() => deletePost(sheet.payload)} onCancel={close} />}
        {sheet?.name === "rep" && sheet.payload && (
          <ReportSheet
            target={{ kind: "post", post: sheet.payload }}
            reporterId={user?.id}
            blocked={suspended}
            store={store} update={update} actions={sheetActions}
          />
        )}
        {sheet?.name === "repUser" && sheet.payload && (
          <ReportSheet
            target={{ kind: "user", userId: sheet.payload.userId, name: sheet.payload.name }}
            reporterId={user?.id}
            blocked={suspended}
            store={store} update={update} actions={sheetActions}
          />
        )}
        {sheet?.name === "profile" && sheet.payload && <ProfileSheet post={sheet.payload} store={store} actions={sheetActions} />}
        {sheet?.name === "req" && <RequestSheet store={store} update={update} actions={sheetActions} />}
        {sheet?.name === "relapse" && <RelapseSheet onNew={newPeriod} onClose={close} />}
        {sheet?.name === "wipe" && <WipeSheet onConfirm={wipeAll} onCancel={close} />}
        {sheet?.name === "confirmLogout" && (
          <ConfirmSheet
            title="Log out?"
            body="You can log back in anytime with the same account."
            confirmLabel="Log out"
            onConfirm={() => { close(); actions.logout(); }}
            onCancel={close}
          />
        )}
        {sheet?.name === "check" && <CheckSheet store={store} update={update} actions={sheetActions} />}
        {sheet?.name === "selfcheck" && <SelfCheckSheet onDone={(score) => { update({ test: score }); setSelfScore(score); open("selfresult"); }} />}
        {sheet?.name === "selfresult" && <SelfResult score={selfScore ?? store.test} done={store.done} actions={sheetActions} />}
        {sheet?.name === "ai" && <AiSheet store={store} update={update} />}
        {sheet?.name === "reassess" && <ReassessSheet onPick={pickReassess} />}
        {sheet?.name === "reassessResult" && <ReassessResult level={reassessLevel} actions={sheetActions} />}
        {sheet?.name === "setpw" && <SetPwSheet onSave={async (v) => {
          try {
            const r = await supabase().auth.updateUser({ password: v });
            if (r.error) throw r.error;
            open("donePw");
            return null;
          } catch (e) { return aerr(e); }
        }} />}
        {sheet?.name === "login" && (
          <>
            <Login setAuthMode={sheetAuthMode} onAuth={onAuth} />
            <button className="btn sec" onClick={() => onAuth({ provider: "google" })} style={{ marginTop: 4 }}>{GoogleIcon}Continue with Google</button>
          </>
        )}
        {sheet?.name === "signup" && (
          <>
            <Signup store={store} update={update} setAuthMode={sheetAuthMode} onAuth={onAuth} />
            <button className="btn sec" onClick={() => onAuth({ provider: "google" })} style={{ marginTop: 4 }}>{GoogleIcon}Continue with Google</button>
          </>
        )}
        {sheet?.name === "donePw" && <><h2>Password updated</h2><button className="btn" onClick={close}>Done</button></>}
      </Sheet>
      <Modal data={modal} onClose={() => setModal(null)} />
    </div>
  );
}
