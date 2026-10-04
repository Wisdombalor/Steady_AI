import { useEffect, useState } from "react";
import { CO, CUR, CCD, MOT } from "../lib/data";
import { GoogleIcon, MailIcon, BackIcon } from "./Icons";
import { PasswordInput } from "./Chrome";
import { DateField } from "./DateField";
import { lt, sanitizeNameInput, isValidName, normalizeName, formatAmountInput, parseAmountInput, PW_REQS, missingPwReqs } from "../lib/helpers";

export function ActivationPanel({ email, onAuth, onWrongEmail, onBack }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const resend = async () => {
    setBusy(true);
    const m = await onAuth({ resend: email });
    setBusy(false);
    if (m) setMsg(m);
  };
  return (
    <div className="ob in">
      {onBack && <button className="chip" onClick={onBack}><BackIcon /> Back</button>}
      <h1>Check your inbox</h1>
      <p className="mu">Your account isn&apos;t activated yet. We sent an activation link to <b>{email}</b> — tap it, then log in. Check spam too.</p>
      <button className="btn" disabled={busy} onClick={resend}>{busy ? "Sending…" : "Resend activation link"}</button>
      {msg && <p className="mu" style={{ marginTop: 8 }}>{msg}</p>}
      <p className="mu" style={{ textAlign: "center", marginTop: 14 }}>Wrong email? <button className="tel" onClick={onWrongEmail}>Sign up with the right one</button></p>
    </div>
  );
}

export function PwChecklist({ pw }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "0 0 8px", fontSize: 13 }}>
      {PW_REQS.map(([label, test]) => {
        const ok = test(pw || "");
        return (
          <li key={label} style={{ color: ok ? "var(--ac)" : "var(--mu)", marginBottom: 2 }}>
            {ok ? "✓ " : "○ "}{label}
          </li>
        );
      })}
    </ul>
  );
}

export function Onboarding({ store, update, ob, setOb, authMode, setAuthMode, onFinish, onAuth, notice }) {
  if (ob === 1) {
    return (
      <div className="ob in">
        <button className="chip" onClick={() => setOb(0)}><BackIcon /> Back</button>
        <h1>Not sure gambling is a problem?</h1>
        <p className="mu">Take a 2-minute self-check. It&apos;s a screening, not a diagnosis.</p>
        <button className="btn" onClick={() => onAuth({ sheet: "selfcheck", fromOnboarding: true })}>Take the self-check</button>
        <br /><br />
        <button className="btn sec" onClick={() => setOb(2)}>Skip for now</button>
      </div>
    );
  }

  if (ob === 2) {
    return <RecoverySetup store={store} update={update} onFinish={onFinish} onBack={() => setOb(1)} />;
  }

  if (authMode === "signup") return <Signup store={store} update={update} setAuthMode={setAuthMode} onAuth={onAuth} />;
  if (authMode === "login") return <Login setAuthMode={setAuthMode} onAuth={onAuth} />;

  return <Welcome store={store} update={update} setAuthMode={setAuthMode} onAuth={onAuth} notice={notice} />;
}

function Welcome({ store, update, setAuthMode, onAuth, notice }) {
  const [name, setName] = useState(store.name || "");
  const [country, setCountry] = useState(store.country || "NG");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const cont = () => {
    const clean = normalizeName(name);
    if (clean.length < 2) { setErr("Please enter your name to continue."); return; }
    if (!isValidName(clean)) { setErr("Please use letters only for your name — no numbers or symbols."); return; }
    update({ name: clean, country });
    onAuth({ nextOb: 1 });
  };

  return (
    <div className="ob in">
      <h1>Welcome to Steady</h1>
      <p className="mu">A recovery companion for the moments that matter. It isn&apos;t a therapist or an emergency service.</p>
      <label>What should we call you? (required)
        <input placeholder="Your name" autoComplete="given-name" value={name} onChange={(e) => setName(sanitizeNameInput(e.target.value))} />
      </label>
      <label>Your country
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          {Object.entries(CO).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
        </select>
      </label>
      <p style={{ color: "var(--bad)", fontSize: 14, minHeight: 20, margin: "0 0 8px" }}>{err}</p>
      <button className="btn" onClick={cont}>Continue</button>
      {notice && (
        <p className="mu" style={{ textAlign: "center", margin: "12px 0 0", ...(notice.kind === "error" ? { color: "var(--bad)" } : null) }}>
          {notice.text}
        </p>
      )}
      <p className="mu" style={{ textAlign: "center", margin: "16px 0 8px" }}>or, optionally, create an account</p>
      <button className="btn sec" onClick={() => onAuth({ provider: "google", country })}>{GoogleIcon}Continue with Google</button>
      <button className="btn sec" onClick={() => { update({ name: normalizeName(name), country }); setAuthMode("signup"); }} style={{ marginTop: 8 }}>{MailIcon}Sign up with email</button>
      <p className="mu" style={{ marginTop: 8 }}>{msg}</p>
      <p className="mu" style={{ textAlign: "center" }}>Already have an account? <button className="tel" onClick={() => { update({ name: normalizeName(name), country }); setAuthMode("login"); }}>Log in</button></p>
    </div>
  );
}

export function Signup({ store, update, setAuthMode, onAuth }) {
  const [name, setName] = useState(store.name || "");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [exists, setExists] = useState(null);

  const submit = async () => {
    const clean = normalizeName(name);
    if (clean.length < 2) { setErr("Please enter your name."); return; }
    if (!isValidName(clean)) { setErr("Please use letters only for your name — no numbers or symbols."); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr("Enter a valid email address."); return; }
    const missing = missingPwReqs(pw);
    if (missing.length) { setErr("Password is too weak — it needs: " + missing.join(", ") + "."); return; }
    setBusy(true);
    update({ name: clean });
    const msg = await onAuth({ signup: { name: clean, email: email.trim(), password: pw } });
    setBusy(false);
    if (typeof msg === "string" && msg.startsWith("UNCONFIRMED:")) setConfirm(email.trim());
    else if (typeof msg === "string" && msg.startsWith("EXISTS:")) setExists(msg.slice("EXISTS:".length));
    else if (msg) setErr(msg);
  };

  if (exists) {
    return (
      <div className="ob in">
        <h1>Account exists</h1>
        <p className="mu">An account with <b>{exists}</b> already exists. Log in instead — your recovery data is waiting.</p>
        <button className="btn" onClick={() => setAuthMode("login")}>Go to log in</button>
        <p className="mu" style={{ textAlign: "center", marginTop: 14 }}><button className="tel" onClick={() => setExists(null)}>Use a different email</button></p>
      </div>
    );
  }

  if (confirm) {
    return <ActivationPanel email={confirm} onAuth={onAuth} onWrongEmail={() => setConfirm(null)} onBack={() => setAuthMode("start")} />;
  }

  return (
    <div className="ob in">
      <button className="chip" onClick={() => setAuthMode("start")}><BackIcon /> Back</button>
      <h1>Sign up with email</h1>
      <label>Your name (required)<input autoComplete="name" value={name} onChange={(e) => setName(sanitizeNameInput(e.target.value))} /></label>
      <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<PasswordInput autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      <PwChecklist pw={pw} />
      <p style={{ color: "var(--bad)", fontSize: 14, minHeight: 20, margin: "0 0 8px" }}>{err}</p>
      <button className="btn" disabled={busy} onClick={submit}>{busy ? "Creating account…" : "Create account"}</button>
      <p className="mu" style={{ textAlign: "center", marginTop: 14 }}>Already have an account? <button className="tel" onClick={() => setAuthMode("login")}>Log in</button></p>
    </div>
  );
}

const RESET_COOLDOWN = 59;
const fmtCountdown = (s) => `0:${String(s).padStart(2, "0")}`;

export function Login({ setAuthMode, onAuth }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [resetSent, setResetSent] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [resetBusy, setResetBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [failedEmail, setFailedEmail] = useState(null);
  const [rqBusy, setRqBusy] = useState(false);
  const [rqMsg, setRqMsg] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const submit = async () => {
    if (!email || !pw) { setErr("Enter your email and password."); return; }
    setBusy(true);
    const msg = await onAuth({ login: { email: email.trim(), password: pw } });
    setBusy(false);
    if (typeof msg === "string" && msg.startsWith("UNCONFIRMED:")) {
      setConfirm(msg.slice("UNCONFIRMED:".length));
      setErr("");
      setFailedEmail(null);
    } else if (msg) {
      setErr(msg);
      // Supabase may report unconfirmed accounts as wrong credentials (to avoid
      // leaking which emails exist), so offer the activation resend here too.
      if (/wrong email or password|invalid login|invalid credentials/i.test(msg)) {
        setFailedEmail(email.trim());
        setRqMsg("");
      } else {
        setFailedEmail(null);
      }
    } else {
      setFailedEmail(null);
    }
  };

  const quickResend = async () => {
    if (!failedEmail) return;
    setRqBusy(true);
    const msg = await onAuth({ resend: failedEmail });
    setRqBusy(false);
    if (msg) setRqMsg(msg);
  };

  const requestReset = async () => {
    const target = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) { setErr("Enter your email above first."); return; }
    setResetBusy(true);
    const msg = await onAuth({ reset: target });
    setResetBusy(false);
    if (msg?.startsWith("If ")) {
      setResent(resetSent != null);
      setResetSent(target);
      setCooldown(RESET_COOLDOWN);
      setErr("");
    } else setErr(msg);
  };

  if (confirm) {
    return (
      <>
        <ActivationPanel
          email={confirm}
          onAuth={onAuth}
          onWrongEmail={() => { setConfirm(null); setAuthMode("signup"); }}
          onBack={() => setAuthMode("start")}
        />
        <p className="mu" style={{ textAlign: "center" }}><button className="tel" onClick={() => setConfirm(null)}>Use a different login</button></p>
      </>
    );
  }

  if (resetSent) {
    return (
      <div className="ob in">
        <h1>Check your inbox</h1>
        <p className="mu">
          {resent ? "A new reset link is on its way" : "We sent a password reset link"} to <b>{resetSent}</b>.
          Check your inbox <b>and spam folder</b>, then tap the link to set a new password.
        </p>
        <button className="btn" disabled={cooldown > 0 || resetBusy} onClick={requestReset}>
          {resetBusy ? "Sending…" : cooldown > 0 ? `Resend link in ${fmtCountdown(cooldown)}` : "Resend link"}
        </button>
        <p style={{ color: "var(--bad)", fontSize: 14, minHeight: 20, margin: "8px 0 0" }}>{err}</p>
        <p className="mu" style={{ textAlign: "center", marginTop: 14 }}><button className="tel" onClick={() => { setResetSent(null); setResent(false); }}>Back to log in</button></p>
      </div>
    );
  }

  return (
    <div className="ob in">
      <button className="chip" onClick={() => setAuthMode("start")}><BackIcon /> Back</button>
      <h1>Log in</h1>
      <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); setFailedEmail(null); }} /></label>
      <label>Password<PasswordInput autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); setFailedEmail(null); }} /></label>
      <p style={{ color: "var(--bad)", fontSize: 14, minHeight: 20, margin: "0 0 8px" }}>{err}</p>
      {failedEmail && (
        <p className="mu" style={{ textAlign: "center" }}>
          Not activated yet?{" "}
          <button className="tel" disabled={rqBusy} onClick={quickResend}>{rqBusy ? "Sending…" : "Resend activation link"}</button>
          {rqMsg ? <> · {rqMsg}</> : null}
        </p>
      )}
      <button className="btn" disabled={busy} onClick={submit}>{busy ? "Logging in…" : "Log in"}</button>
      <p className="mu" style={{ textAlign: "center", marginTop: 14 }}><button className="tel" onClick={requestReset}>Forgot password?</button></p>
      <p className="mu" style={{ textAlign: "center" }}>New here? <button className="tel" onClick={() => setAuthMode("signup")}>Sign up</button></p>
    </div>
  );
}

export function RecoverySetup({ store, update, onFinish, onBack }) {
  const hasAccount = !!store.email;
  const [date, setDate] = useState("");
  const [cc, setCc] = useState(store.cc || CCD[store.country]);
  const [spend, setSpend] = useState("");
  const [bio, setBio] = useState(store.bio || "");
  const [err, setErr] = useState("");

  const submit = () => {
    if (!date) { setErr("Please enter your recovery start date."); return; }
    const dd = new Date(date + "T00:00:00").getTime();
    if (isNaN(dd)) { setErr("That date isn't valid. Please pick it again."); return; }
    if (dd - Date.now() > 864e5) { setErr("Please choose today or an earlier date. Your device date is " + lt() + "."); return; }
    const amount = parseAmountInput(spend);
    if (spend === "" || isNaN(amount) || amount < 0) { setErr("Please enter how much you spent per week (0 if none)."); return; }
    update({ start: Math.min(Date.now(), dd), cc, spend: amount, ...(hasAccount ? { bio: bio.trim().slice(0, 160) } : null) });
    onFinish();
  };

  return (
    <div className="ob in">
      {onBack && <button className="chip" onClick={onBack} style={{ marginBottom: 4 }}><BackIcon /> Back</button>}
      <h1>Your recovery</h1>
      <DateField label="When did your recovery start?" value={date} onChange={setDate} />
      <label>Roughly how much did you spend gambling per week? (used for &quot;money saved&quot;)</label>
      <div className="row" style={{ gap: 8 }}>
        <select style={{ width: "44%" }} value={cc} onChange={(e) => setCc(e.target.value)}>
          {CUR.map((c) => <option key={c[0]} value={c[0]}>{c[1] !== c[0] ? `${c[0]} (${c[1]})` : c[0]}</option>)}
        </select>
        <input type="text" inputMode="decimal" placeholder="Amount per week" style={{ flex: 1 }} value={spend} onChange={(e) => setSpend(formatAmountInput(e.target.value))} />
      </div>
      {hasAccount && (
        <>
          <label>Bio (optional)
            <textarea rows={2} maxLength={160} placeholder="A line about yourself for the community" value={bio} onChange={(e) => setBio(e.target.value)} />
          </label>
          <p className="mu" style={{ marginTop: -8 }}>{bio.length}/160</p>
        </>
      )}
      <p style={{ color: "var(--bad)", fontSize: 14, minHeight: 20, margin: "0 0 8px" }}>{err}</p>
      <button className="btn" onClick={submit}>Start my recovery</button>
    </div>
  );
}
