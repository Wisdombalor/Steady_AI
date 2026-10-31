import { useCallback, useRef, useState } from "react";

const KEY = "steady";
const accountKey = (id) => `${KEY}-account:${id}`;

export function loadAccountStore(id) {
  try { const raw = localStorage.getItem(accountKey(id)); return raw ? migrate({ ...freshStore(), ...JSON.parse(raw) }) : null; }
  catch { return null; }
}

export function forgetAccountStore(id) {
  try { localStorage.removeItem(accountKey(id)); } catch {}
}

export const freshStore = () => ({
  name: "",
  bio: "",
  avatar: "",
  chats: [],
  start: 0,
  spend: 0,
  cc: undefined,
  country: "NG",
  urges: [],
  periods: [],
  posts: [],
  trusted: [],
  hidden: [],
  rules: 0,
  test: null,
  done: 0,
  outbox: [],
  checks: [],
  email: "",
});

export function loadStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshStore();
    const s = { ...freshStore(), ...JSON.parse(raw) };
    s.posts = (s.posts || []).filter((p) => !p.s);
    s.checks = s.checks || [];
    s.outbox = s.outbox || [];
    return migrate(s);
  } catch {
    return freshStore();
  }
}

// One-time migration: spend used to be entered per day, now it is per week.
// Scale old values so "money saved" stays continuous.
export function migrate(s) {
  s = { ...s, outbox: (s.outbox || []).map((item, index) => item.id ? item : { ...item, id: `legacy-${index}-${Date.now()}` }) };
  if (s && !s.spendMigrated) {
    const spend = (s.spend || 0) > 0 ? Math.round(s.spend * 7 * 100) / 100 : (s.spend || 0);
    return { ...s, spend, spendMigrated: 1 };
  }
  return s;
}

export function useSteadyStore() {
  const [store, setStore] = useState(loadStore);
  const current = useRef(store);

  const persist = useCallback((next) => {
    // Keep in-memory updates synchronous: a save or sign-out immediately
    // after an edit must see that edit, not the previous React render.
    current.current = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      if (next.userId) localStorage.setItem(accountKey(next.userId), JSON.stringify(next));
    }
    catch { next = { ...next, _storageError: true }; current.current = next; }
    setStore(next);
    return next;
  }, []);

  const update = useCallback(
    (fn) => {
      const prev = current.current;
      const patch = typeof fn === "function" ? fn(prev) : fn;
      const dirty = Object.keys(patch).some((k) => !["posts", "outbox"].includes(k) && !k.startsWith("_"));
      return persist({ ...prev, ...patch, ...(dirty ? { _pendingSync: true } : {}) });
    },
    [persist]
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    current.current = freshStore();
    setStore(current.current);
  }, []);

  const replaceAll = persist;

  return [store, update, reset, replaceAll, setStore];
}

