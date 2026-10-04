import { CUR, CCD } from "./data";

export const mmss = (s) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");

export const lt = () => {
  const n = new Date();
  return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
};
export const dstr = (ms) => {
  const n = new Date(ms);
  return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
};
export const today = lt;

export const elapsed = (start) => (start ? Date.now() - start : 0);
export const daysSince = (start) => Math.floor(elapsed(start) / 864e5);
export const bestStreak = (store) => Math.max(daysSince(store.start), ...(store.periods || []).map((p) => p.days), 0);
export const moneySaved = (store) => Math.round(elapsed(store.start) / (7 * 864e5) * (store.spend || 0));

export const currencySymbol = (store) => {
  const code = store.cc || CCD[store.country];
  const c = CUR.find((x) => x[0] === code);
  return c ? c[1] : "$";
};
export const fm = (store, n) => currencySymbol(store) + n.toLocaleString();

export const calcExpr = (x) => {
  x = String(x).replace(/\^/g, "**").replace(/,/g, "");
  if (!/^[\d\s+\-*\/().%e]+$/i.test(x)) throw new Error("Unsupported expression");
  const r = Function('"use strict";return (' + x + ')')();
  if (!isFinite(r)) throw new Error("Not a finite number");
  return r;
};

export const aerr = (e) => {
  const m = String((e && e.message) || "");
  if (e === "net") return "Couldn't reach the sign-in service from here. It works once the app is hosted.";
  if (/invalid login/i.test(m)) return "Wrong email or password.";
  if (/already registered|already been registered/i.test(m)) return "That email already has an account. Try logging in.";
  if (/not confirmed/i.test(m)) return "Please confirm your email first. Check your inbox for the link.";
  if (/rate limit|too many|seconds/i.test(m)) return "Too many attempts. Wait a moment and try again.";
  if (/password/i.test(m)) return "Use a stronger password: 8+ characters with an uppercase letter, lowercase letter, number and symbol.";
  if (/valid email|invalid.*email/i.test(m)) return "That email address doesn't look right.";
  if (/network|fetch/i.test(m)) return "Network problem. Check your connection.";
  return "Something went wrong. Please try again.";
};

export function useNow(intervalMs = 1000, active = true) {
  // tiny hook without importing React here is avoided — implemented in App via useState/useEffect.
  // kept as helper placeholder.
  return Date.now();
}

// Amount: comma after every 3 digits, e.g. 1000 -> "1,000"
export const formatAmountInput = (raw) => {
  let s = String(raw ?? "").replace(/,/g, "").trim();
  if (s === "") return "";
  s = s.replace(/[^0-9.]/g, "");
  if (s === "" || s === ".") return "";
  const dotIdx = s.indexOf(".");
  let int = dotIdx === -1 ? s : s.slice(0, dotIdx);
  let dec = dotIdx === -1 ? "" : s.slice(dotIdx + 1).replace(/\./g, "").slice(0, 2);
  int = int.replace(/^0+(?=\d)/, "");
  if (int === "") int = dotIdx === 0 ? "0" : "";
  if (int !== "") int = Number(int).toLocaleString("en-US");
  if (dotIdx === -1) return int;
  return (int === "" ? "0" : int) + "." + dec;
};

export const parseAmountInput = (formatted) => {
  if (formatted === "" || formatted == null) return NaN;
  const n = parseFloat(String(formatted).replace(/,/g, ""));
  return n;
};

// Urge triggers/feelings: new records store arrays (multi-select + custom typed),
// legacy records store single strings. Normalize to arrays everywhere.
export const urgeTrigs = (u) => {
  if (Array.isArray(u?.trigs)) return u.trigs.filter(Boolean);
  if (u?.trig) return [u.trig];
  return [];
};
export const urgeEmos = (u) => {
  if (Array.isArray(u?.emos)) return u.emos.filter(Boolean);
  if (u?.emo) return [u.emo];
  return [];
};

// Names: letters only — no numbers, no symbols
export const sanitizeNameInput = (v) => String(v ?? "").replace(/[^\p{L} ]/gu, "");

export const isValidName = (name) => {
  const t = String(name ?? "").trim().replace(/\s+/g, " ");
  return t.length >= 2 && /^[\p{L} ]+$/u.test(t);
};

export const normalizeName = (name) => String(name ?? "").trim().replace(/\s+/g, " ");

// Password strength: at least one of each, else rejected as weak.
export const PW_REQS = [
  ["8+ characters", (p) => p.length >= 8],
  ["Uppercase letter (A–Z)", (p) => /[A-Z]/.test(p)],
  ["Lowercase letter (a–z)", (p) => /[a-z]/.test(p)],
  ["Number (0–9)", (p) => /\d/.test(p)],
  ["Symbol (e.g. !@#$%)", (p) => /[^A-Za-z0-9]/.test(p)],
];
export const missingPwReqs = (pw) => PW_REQS.filter(([, test]) => !test(pw || "")).map(([label]) => label);
export const isStrongPassword = (pw) => missingPwReqs(pw).length === 0;
