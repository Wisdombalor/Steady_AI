import { useCallback, useState } from "react";

const KEY = "steady";

export const freshStore = () => ({
  name: "",
  bio: "",
  avatar: "",
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
  if (s && !s.spendMigrated) {
    const spend = (s.spend || 0) > 0 ? Math.round(s.spend * 7 * 100) / 100 : (s.spend || 0);
    return { ...s, spend, spendMigrated: 1 };
  }
  return s;
}

export function useSteadyStore(user, queuePush) {
  const [store, setStore] = useState(loadStore);

  const update = useCallback(
    (fn) => {
      setStore((prev) => {
        const next = typeof fn === "function" ? fn(prev) : fn;
        const merged = { ...prev, ...next };
        try {
          localStorage.setItem(KEY, JSON.stringify(merged));
        } catch {}
        if (user && queuePush) queuePush();
        return merged;
      });
    },
    [user, queuePush]
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    setStore(freshStore());
  }, []);

  const replaceAll = useCallback((next) => {
    setStore(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, []);

  return [store, update, reset, replaceAll, setStore];
}
