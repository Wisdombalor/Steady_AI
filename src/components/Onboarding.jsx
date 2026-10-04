import { useState } from "react";
import { CO, CUR, CCD, MOT } from "../lib/data";
import { GoogleIcon, MailIcon, BackIcon } from "./Icons";
import { DateField } from "./DateField";
import { lt, sanitizeNameInput, isValidName, normalizeName, formatAmountInput, parseAmountInput } from "../lib/helpers";

export function Onboarding({ store, update, ob, setOb, authMode, setAuthMode, onFinish, onAuth }) {
  if (ob === 1) {
    return (
      <div className="ob in">
        <h1>Not sure gambling is a problem?</h1>
        <p className="mu">Take a 2-minute self-check. It&apos;s a screening, not a diagnosis.</p>
        <button className="btn" onClick={() => onAuth({ sheet: "selfcheck", fromOnboarding: true })}>Take the self-check</button>
        <br /><br />
        <button className="btn sec" onClick={() => setOb(2)}>Skip for now</button>
      </div>
    );
  }

  if (ob === 2) {
    return <RecoverySetup store={store} update={update} onFinish={onFinish} />;
  }

  if (authMode === "signup") return <Signup store={store} update={update} setAuthMode={setAuthMode} onAuth={onAuth} />;
  if (authMode === "login") return <Login setAuthMode={setAuthMode} onAuth={onAuth} />;

  return <Welcome store={store} update={update} setAuthMode={setAuthMode} onAuth={onAuth} />;
}

function Welcome({ store, update, setAuthMode, onAuth }) {
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
  const [bio, setBio] = useState(store.bio || "");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const clean = normalizeName(name);
    if (clean.length < 2) { setErr("Please enter your name."); return; }
    if (!isValidName(clean)) { setErr("Please use letters only for your name — no numbers or symbols."); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr("Enter a valid email address."); return; }
    if (pw.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setBusy(true);
    update({ name: clean, bio: bio.trim().slice(0, 160) });
    const msg = await onAuth({ signup: { name: clean, email: email.trim(), password: pw } });
    setBusy(false);
    if (msg) setErr(msg);
  };

  return (
    <div className="ob in">
      <button className="chip" onClick={() => setAuthMode("start")}><BackIcon /> Back</button>
      <h1>Sign up with email</h1>
      <label>Your name (required)<input autoComplete="name" value={name} onChange={(e) => setName(sanitizeNameInput(e.target.value))} /></label>
      <label>Bio (optional)<textarea rows={2} maxLength={160} placeholder="A line about yourself for the community" value={bio} onChange={(e) => setBio(e.target.value)} /></label>
      <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password (8+ characters)<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      <p style={{ color: "var(--bad)", fontSize: 14, minHeight: 20, margin: "0 0 8px" }}>{err}</p>
      <button className="btn" disabled={busy} onClick={submit}>{busy ? "Creating account…" : "Create account"}</button>
      <p className="mu" style={{ textAlign: "center", marginTop: 14 }}>Already have an account? <button className="tel" onClick={() => setAuthMode("login")}>Log in</button></p>
    </div>
  );
}

export function Login({ setAuthMode, onAuth }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || !pw) { setErr("Enter your email and password."); return; }
    setBusy(true);
    const msg = await onAuth({ login: { email: email.trim(), password: pw } });
    setBusy(false);
    if (msg) setErr(msg);
  };

  const reset = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr("Enter your email above first."); return; }
    const msg = await onAuth({ reset: email.trim() });
    if (msg?.startsWith("If ")) { setOk(msg); setErr(""); } else setErr(msg);
  };

  return (
    <div className="ob in">
      <button className="chip" onClick={() => setAuthMode("start")}><BackIcon /> Back</button>
      <h1>Log in</h1>
      <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      <p style={{ color: "var(--bad)", fontSize: 14, minHeight: 20, margin: "0 0 8px" }}>{err}</p>
      {ok && <p className="mu">{ok}</p>}
      <button className="btn" disabled={busy} onClick={submit}>{busy ? "Logging in…" : "Log in"}</button>
      <p className="mu" style={{ textAlign: "center", marginTop: 14 }}><button className="tel" onClick={reset}>Forgot password?</button></p>
      <p className="mu" style={{ textAlign: "center" }}>New here? <button className="tel" onClick={() => setAuthMode("signup")}>Sign up</button></p>
    </div>
  );
}

export function RecoverySetup({ store, update, onFinish }) {
  const [date, setDate] = useState("");
  const [cc, setCc] = useState(store.cc || CCD[store.country]);
  const [spend, setSpend] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    if (!date) { setErr("Please enter your recovery start date."); return; }
    const dd = new Date(date + "T00:00:00").getTime();
    if (isNaN(dd)) { setErr("That date isn't valid. Please pick it again."); return; }
    if (dd - Date.now() > 864e5) { setErr("Please choose today or an earlier date. Your device date is " + lt() + "."); return; }
    const amount = parseAmountInput(spend);
    if (spend === "" || isNaN(amount) || amount < 0) { setErr("Please enter how much you spent per week (0 if none)."); return; }
    update({ start: Math.min(Date.now(), dd), cc, spend: amount });
    onFinish();
  };

  return (
    <div className="ob in">
      <h1>Your recovery</h1>
      <DateField label="When did your recovery start?" value={date} onChange={setDate} />
      <label>Roughly how much did you spend gambling per week? (used for &quot;money saved&quot;)</label>
      <div className="row" style={{ gap: 8 }}>
        <select style={{ width: "44%" }} value={cc} onChange={(e) => setCc(e.target.value)}>
          {CUR.map((c) => <option key={c[0]} value={c[0]}>{c[1] !== c[0] ? `${c[0]} (${c[1]})` : c[0]}</option>)}
        </select>
        <input type="text" inputMode="decimal" placeholder="Amount per week" style={{ flex: 1 }} value={spend} onChange={(e) => setSpend(formatAmountInput(e.target.value))} />
      </div>
      <p style={{ color: "var(--bad)", fontSize: 14, minHeight: 20, margin: "0 0 8px" }}>{err}</p>
      <button className="btn" onClick={submit}>Start my recovery</button>
    </div>
  );
}
