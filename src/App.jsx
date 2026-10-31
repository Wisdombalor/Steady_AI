import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { CO, MOT } from "./lib/data";
import { useSteadyStore, freshStore, migrate, loadAccountStore, forgetAccountStore } from "./lib/store";
import { supabase, loadPosts, sendReport, insertPost, getModState, syncProfile, deleteAccount } from "./lib/backend";
import { cloudData, saveRecoveryData, isSyncConflict } from "./lib/sync";
import { resolveAccountStore } from "./lib/account";
import { aerr, daysSince } from "./lib/helpers";
import { Nav, Sheet, Modal } from "./components/Chrome";
import { Onboarding, Login, Signup, RecoverySetup } from "./components/Onboarding";
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

const AdminApp = lazy(() => import("./components/Admin").then((m) => ({ default: m.AdminApp })));

function stageFor(days) {
  return days < 1 ? "Starting out" : days <= 7 ? "1–7 days" : days <= 30 ? "8–30 days"
    : days <= 90 ? "31–90 days" : days <= 180 ? "3–6 months" : days <= 365 ? "6–12 months" : "1+ year";
}

export default function App() {
  const [user, setUser] = useState(null);
  const pushTimer = useRef(null);
  const accountLoad = useRef(null);
  const syncedUserId = useRef(null);
  const saveTask = useRef(null);
  const conflictRef = useRef(false);
  const [syncIssue, setSyncIssue] = useState(null);
  const [store, updateStore, resetStore, replaceAll] = useSteadyStore();
  const storeRef = useRef(store);
  storeRef.current = store;
  const update = useCallback((patch) => {
    const next = updateStore(patch);
    storeRef.current = next;
    return next;
  }, [updateStore]);
  const userRef = useRef(user);
  userRef.current = user;

  const doPush = useCallback(async () => {
    if (conflictRef.current) return false;
    if (saveTask.current) return saveTask.current;
    const u = userRef.current, snapshot = storeRef.current;
    if (!u || syncedUserId.current !== u.id || snapshot.userId !== u.id || !snapshot._pendingSync) return true;
    const task = (async () => {
      try {
        const a = supabase();
        const revision = await saveRecoveryData(a, u.id, snapshot);
        if (syncedUserId.current !== u.id || userRef.current?.id !== u.id) return false;
        update({ _revision: revision });
        // Save public profile fields as part of the same retryable sync task.
        await syncProfile(u, { displayName: snapshot.name, avatarUrl: snapshot.avatar, bio: snapshot.bio });
        if (syncedUserId.current !== u.id) return false;
        update((latest) => ({ _revision: revision, _pendingSync: JSON.stringify(cloudData(latest)) !== JSON.stringify(cloudData(snapshot)) }));
        setSyncIssue(null);
        return true;
      } catch (error) {
        if (userRef.current?.id === u.id) { conflictRef.current = isSyncConflict(error); setSyncIssue(conflictRef.current ? "conflict" : "failed"); }
        return false;
      }
    })();
    saveTask.current = task;
    try { return await task; } finally { if (saveTask.current === task) saveTask.current = null; }
  }, [update]);

  useEffect(() => {
    clearTimeout(pushTimer.current);
    if (user && store._pendingSync && syncIssue !== "conflict") pushTimer.current = setTimeout(doPush, 1200);
    return () => clearTimeout(pushTimer.current);
  }, [store, user, doPush, syncIssue]);

  useEffect(() => {
    const retry = () => { if (navigator.onLine) doPush(); };
    window.addEventListener("online", retry);
    const timer = setInterval(retry, 30000);
    return () => { window.removeEventListener("online", retry); clearInterval(timer); };
  }, [doPush]);

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
  const [filters, setFilters] = useState({ time: "all", stage: "all", mine: false });
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
    let active = true;
    getModState(user.id).then((value) => { if (active) setMod(value); }).catch(() => { if (active) setMod({ role: "user", status: "active" }); });
    return () => { active = false; };
  }, [user]);

  const suspended = !!user && mod.status !== "active";
  const feedPage = useRef(0);
  const feedRequest = useRef(0);
  const [morePosts, setMorePosts] = useState(true);
  const [feedError, setFeedError] = useState("");

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

  const refreshPosts = useCallback(async (more = false) => {
    const request = ++feedRequest.current;
    const owner = userRef.current?.id || null;
    const page = more ? feedPage.current + 1 : 0;
    try {
      const remote = await loadPosts(userRef.current, page);
      if (request !== feedRequest.current || owner !== (userRef.current?.id || null)) return;
      feedPage.current = page;
      setMorePosts(remote.length >= 100);
      setFeedError("");
      const previous = more ? storeRef.current.posts : storeRef.current.posts.filter((x) => String(x.id).startsWith("p"));
      update({ posts: [...new Map([...previous, ...remote].map((post) => [post.id, post])).values()] });
    } catch {
      if (request === feedRequest.current && owner === (userRef.current?.id || null)) setFeedError("Couldn't load posts. Please try again.");
    }
  }, [update]);

  useEffect(() => { if (tab === "com") refreshPosts(); }, [tab, refreshPosts]);

  useEffect(() => {
    let active = true;
    let flushing = false;
    const controller = new AbortController();
    const flush = async () => {
      if (flushing || !navigator.onLine || !storeRef.current.done) return;
      const owner = userRef.current?.id || null;
      flushing = true;
      try {
        for (const item of [...storeRef.current.outbox]) {
          if (!active || owner !== (userRef.current?.id || null)) break;
          const sent = await sendReport(item.subject, item.f, undefined, controller.signal);
          if (sent && active && owner === (userRef.current?.id || null)) update((prev) => ({ outbox: prev.outbox.filter((x) => x.id !== item.id) }));
        }
      } catch { /* Keep undelivered messages queued. */ } finally { flushing = false; }
    };
    flush();
    window.addEventListener("online", flush);
    const timer = setInterval(flush, 30000);
    return () => { active = false; controller.abort(); window.removeEventListener("online", flush); clearInterval(timer); };
  }, [store.done, store.outbox, update]);

  // Track the session for the life of the app so refreshes, restores and
  // token refreshes keep the user signed in (persisted by supabase-js).
  // authReady flips on the first auth event (or a safety timeout) so a
  // returning account holder never sees onboarding flash before restore.
  useEffect(() => {
    let sub = null;
    let activeSessionId = null;
    let disposed = false;
    const readyTimer = setTimeout(() => setAuthReady(true), 6000);
    (async () => {
      try {
        const a = supabase();
        const { data } = a.auth.onAuthStateChange((ev, session) => {
          activeSessionId = session?.user?.id || null;
          if (ev === "PASSWORD_RECOVERY") { open("setpw"); }
          if (ev === "SIGNED_OUT") {
            feedRequest.current++;
            syncedUserId.current = null;
            accountLoad.current = null;
            clearTimeout(pushTimer.current);
            userRef.current = null;
            storeRef.current = freshStore();
            setUser(null);
            resetStore();
            setOb(0);
            setAuthReady(true);
            return;
          }
          if (session?.user) {
            // Supabase holds its auth lock during this callback. Run database
            // requests after it returns so session restoration cannot deadlock.
            setTimeout(() => {
              if (disposed || activeSessionId !== session.user.id) return;
              handleUser(session.user, ev !== "TOKEN_REFRESHED" && ev !== "PASSWORD_RECOVERY")
                .catch(() => setOauthNote({ kind: "error", text: "Couldn't load your progress. Please try signing in again." }))
                .finally(() => setAuthReady(true));
            }, 0);
          } else {
            setAuthReady(true);
            if (ev === "INITIAL_SESSION") refreshPosts();
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
                  await handleUser(s.session.user);
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
    return () => { disposed = true; clearTimeout(readyTimer); try { sub?.unsubscribe(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every auth entry point uses persisted completion, never account age or
  // the login form used. Coalesce the listener and form/redirect callbacks.
  const handleUser = (u, fresh = true) => {
    if (accountLoad.current?.id === u.id) return accountLoad.current.promise;
    if (syncedUserId.current === u.id) {
      setUser(u);
      return Promise.resolve();
    }
    syncedUserId.current = null;
    clearTimeout(pushTimer.current);
    const load = { id: u.id, promise: null };
    accountLoad.current = load;
    load.promise = (async () => {
      const a = supabase();
      const { data, error } = await a.from("user_data").select("data,revision").eq("user_id", u.id).maybeSingle();
      // A failed lookup is not proof that this is a new account. Do not
      // overwrite existing cloud progress with a fresh browser's empty state.
      if (error) throw error;
      if (accountLoad.current !== load) return;
      const active = storeRef.current;
      const local = active.userId === u.id ? active : loadAccountStore(u.id) || active;
      const next = migrate(resolveAccountStore(u, data?.data, local, freshStore));
      next._revision = local.userId === u.id && (local._pendingSync || next._legacyConflict) ? (local._revision || 0) : (data?.revision || 0);
      if (next._legacyConflict || (local.userId === u.id && local._pendingSync && next._revision !== (data?.revision || 0))) { conflictRef.current = true; setSyncIssue("conflict"); }
      storeRef.current = next;
      replaceAll(next);
      syncedUserId.current = u.id;
      userRef.current = u;
      setUser(u);
      if (!next.done) { setAuthMode("start"); setOb(1); }
      if (fresh) {
        close();
        if (next.done) setTab("home");
      }
      // Profile and community requests must not hold up onboarding.
      refreshPosts();

    })().finally(() => {
      if (accountLoad.current === load) accountLoad.current = null;
    });
    return load.promise;
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
      if (storeRef.current._pendingSync && !(await doPush())) return "Your changes are still on this device. Save them before signing out.";
      const { error } = await supabase().auth.signOut();
      if (error) return "Couldn't sign out. Please try again.";
      feedRequest.current++;
      syncedUserId.current = null;
      accountLoad.current = null;
      userRef.current = null;
      setUser(null);
      storeRef.current = freshStore();
      resetStore();
      conflictRef.current = false; setSyncIssue(null);
      setTab("home"); setOb(0); setAuthMode("start");
      return null;
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
          body: text, visibility: visibility === "me" ? "private" : "community",
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

  // Switch an own post between Only me (private) and Public (community).
  // Returns an error string, or null on success.
  const setPostVisibility = async (post, visibility) => {
    const v = visibility === "com" ? "com" : "me";
    if (suspended) return "Community posting is restricted for this account.";
    if (v === "com" && String(post.id).startsWith("p")) {
      if (!user) return "Sign in to share this post.";
      const owner = user.id;
      try {
        await insertPost(supabase(), { user_id: owner, body: post.t, visibility: "community", stage: post.stage || "", display_name: storeRef.current.name, _av: storeRef.current.avatar, _bio: storeRef.current.bio, _days: daysSince(storeRef.current.start) });
        if (userRef.current?.id !== owner) return "Account changed. Please try again.";
        update((prev) => ({ posts: prev.posts.filter((p) => p.id !== post.id) }));
        await refreshPosts(); return null;
      } catch { return "Couldn't publish the post. It is still private on this device."; }
    }
    update((prev) => ({ posts: prev.posts.map((p) => (p.id === post.id ? { ...p, v } : p)) }));
    if (user && !String(post.id).startsWith("p")) {
      try {
        const { error } = await supabase().from("posts").update({ visibility: v === "com" ? "community" : "private" }).eq("id", post.id);
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
    const owner = userRef.current?.id;
    try {
      if (owner && post.mine && !String(post.id).startsWith("p")) {
        const { error } = await supabase().from("posts").delete().eq("id", post.id).eq("user_id", owner);
        if (error) throw error;
      }
      if (owner !== userRef.current?.id) return "Account changed. Please try again.";
      update((prev) => ({ posts: prev.posts.filter((x) => x.id !== post.id) }));
      close();
      return null;
    } catch { return "Couldn't delete the post. It is still saved. Please try again."; }
  };

  const wipeAll = async () => {
    const owner = userRef.current?.id;
    try {
      clearTimeout(pushTimer.current);
      if (saveTask.current) await saveTask.current;
      if (owner) await deleteAccount();
      // Invalidate all in-flight account work only after server confirmation.
      feedRequest.current++;
      syncedUserId.current = null;
      accountLoad.current = null;
      if (owner) await supabase().auth.signOut({ scope: "local" });
      if (owner) forgetAccountStore(owner);
      userRef.current = null;
      setUser(null);
      storeRef.current = freshStore();
      resetStore();
      conflictRef.current = false; setSyncIssue(null);
      setFilters({ time: "all", stage: "all", mine: false });
      setTab("home"); setOb(0); setAuthMode("start"); close();
      return null;
    } catch { return "Deletion was not confirmed. Your data has not been cleared from this device. Please try again."; }
  };

  const syncNotice = (store._storageError || (user && (syncIssue || store._pendingSync))) ? (
    <div className="card sync-notice" role="status">
      {store._storageError ? "This browser couldn't save your progress. Free storage space before closing Steady." : syncIssue === "conflict"
        ? "Different saved progress was found in your account. Your changes are safe on this device; choose which version to keep."
        : syncIssue ? "Your changes are saved on this device but haven't synced yet." : "Saving your progress…"}
      {syncIssue === "failed" && <button className="chip" onClick={doPush}>Retry save</button>}
      {syncIssue === "conflict" && <button className="chip" onClick={() => open("syncConflict")}>Review saved progress</button>}
    </div>
  ) : null;

  const conflictPanel = sheet?.name === "syncConflict" && <ConfirmSheet
          title="Which progress should we keep?"
          body="Keeping this device replaces the saved recovery snapshot in your account. Loading your account replaces unsynced recovery edits on this device. Private posts on this device are kept."
          confirmLabel="Keep this device's progress"
          cancelLabel="Load saved account progress"
          onConfirm={async () => {
            const owner = userRef.current?.id;
            const { data, error } = await supabase().from("user_data").select("revision").eq("user_id", owner).maybeSingle();
            if (error || owner !== userRef.current?.id) return "Couldn't check saved progress. Please try again.";
            update({ _revision: data?.revision || 0 }); conflictRef.current = false; setSyncIssue(null);
            if (!(await doPush())) return "Couldn't save yet. Please try again.";
            close(); return null;
          }}
          onCancel={async () => {
            const owner = userRef.current?.id;
            const { data, error } = await supabase().from("user_data").select("data,revision").eq("user_id", owner).maybeSingle();
            if (error || !data || owner !== userRef.current?.id) return "Couldn't load saved progress. Please try again.";
            const local = { ...storeRef.current, _pendingSync: false };
            const next = migrate(resolveAccountStore(userRef.current, data.data, local, freshStore));
            next._revision = data.revision; next._pendingSync = false;
            storeRef.current = next; replaceAll(next); conflictRef.current = false; setSyncIssue(null); close(); return null;
          }} />;

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

  // Dedicated admin route (#/admin). Guarded inside AdminApp; the backend
  // enforces admin rights independently via RLS on every query.
  const adminPath = hash.startsWith("#/admin") ? (hash.slice("#/admin".length) || "/") : null;
  if (adminPath != null) {
    return (
      <div id="app">
        {veil}
        <main id="main">
          <Suspense fallback={<p className="mu" role="status">Loading admin tools…</p>}><AdminApp
            user={user} mod={mod} path={adminPath} store={store} update={update}
            onAuth={onAuth} authMode={authMode} setAuthMode={setAuthMode}
            onExit={() => { window.location.hash = "#/"; }}
            onSignOut={actions.logout}
            refreshMod={refreshMod}
          /></Suspense>
        </main>
        <nav id="nav" />
      </div>
    );
  }

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
          {syncNotice}
          <Onboarding store={store} update={update} ob={ob} setOb={setOb} authMode={authMode} setAuthMode={setAuthMode}
            onFinish={onFinishOnboarding} onAuth={onAuth} notice={oauthNote} />
        </main>
        <nav id="nav" />
        <Sheet open={!!sheet} onClose={close}>
          {conflictPanel}
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
        {syncNotice}
        {suspended && <div className="card" role="status">Community posting is restricted for this account. Your recovery tools and Support are still available.</div>}
        {!!mod.warnings && <p role="status">Your account has {mod.warnings} moderation warning(s). Please review the community rules.</p>}
        {tab === "home" && <Home store={store} actions={sheetActions} />}
        {tab === "rec" && <Recovery store={store} actions={sheetActions} />}
        {tab === "com" && <Community store={store} filters={filters} setFilters={setFilters} onOpen={open} user={user} actions={sheetActions} onVisibility={setPostVisibility} more={morePosts} onMore={() => refreshPosts(true)} error={feedError} onRetry={() => refreshPosts()} blocked={suspended} />}
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
        {conflictPanel}
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
        {sheet?.name === "startdate" && (
          <RecoverySetup
            store={store} update={update}
            onFinish={() => { update({ done: 1 }); close(); }}
            onBack={close}
          />
        )}
        {sheet?.name === "wipe" && <WipeSheet authed={!!user} onConfirm={wipeAll} onCancel={close} />}
        {sheet?.name === "confirmLogout" && (
          <ConfirmSheet
            title="Sign out?"
            body="You can sign back in anytime with the same account."
            confirmLabel="Sign out"
            onConfirm={actions.logout}
            onCancel={close}
          />
        )}
        {sheet?.name === "check" && <CheckSheet store={store} update={update} actions={sheetActions} />}
        {sheet?.name === "selfcheck" && <SelfCheckSheet onDone={(score) => { update({ test: score }); setSelfScore(score); open("selfresult"); }} />}
        {sheet?.name === "selfresult" && <SelfResult score={selfScore ?? store.test} done={store.done} actions={sheetActions} />}
        {sheet?.name === "ai" && <AiSheet store={store} update={update} actions={sheetActions} />}
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

