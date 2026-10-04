import { useState } from "react";
import { CO, CUR, CCD } from "../lib/data";
import { dstr, formatAmountInput, parseAmountInput, sanitizeNameInput, isValidName, normalizeName, lt, daysSince, fm } from "../lib/helpers";
import { uploadAvatar } from "../lib/backend";
import { DateField } from "./DateField";

const BIO_MAX = 160;

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("Please choose an image file.")); return; }
    if (file.size > 2 * 1024 * 1024) { reject(new Error("Please choose an image under 2MB.")); return; }
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Couldn't read that picture. Try another."));
    r.readAsDataURL(file);
  });
}

export function Profile({ store, update, actions, authed, userId }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(store.name || "");
  const [bio, setBio] = useState(store.bio || "");
  const [country, setCountry] = useState(store.country || "NG");
  const [date, setDate] = useState(store.start ? dstr(store.start) : "");
  const [cc, setCc] = useState(store.cc || CCD[store.country]);
  const [spend, setSpend] = useState(store.spend != null && store.spend !== "" ? formatAmountInput(String(store.spend)) : "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [flash, setFlash] = useState("");

  const startEdit = () => {
    setName(store.name || "");
    setBio(store.bio || "");
    setCountry(store.country || "NG");
    setDate(store.start ? dstr(store.start) : "");
    setCc(store.cc || CCD[store.country]);
    setSpend(store.spend != null && store.spend !== "" ? formatAmountInput(String(store.spend)) : "");
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(false);
    setErr("");
    setFlash("");
    setEditing(true);
  };

  const pickFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErr("Please choose an image file."); return; }
    if (f.size > 2 * 1024 * 1024) { setErr("Please choose an image under 2MB."); return; }
    setErr("");
    setRemoveAvatar(false);
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    setErr("");
    const clean = normalizeName(name);
    if (clean.length < 2) { setErr("Please enter your name."); return; }
    if (!isValidName(clean)) { setErr("Please use letters only for your name — no numbers or symbols."); return; }
    if (!date) { setErr("Please pick your recovery start date."); return; }
    const dd = new Date(date + "T00:00:00").getTime();
    if (isNaN(dd)) { setErr("That date isn't valid. Please pick it again."); return; }
    if (dd - Date.now() > 864e5) { setErr("Please choose today or an earlier date. Your device date is " + lt() + "."); return; }
    const amount = parseAmountInput(spend);
    if (spend === "" || isNaN(amount) || amount < 0) { setErr("Please enter a valid amount per week (0 if none)."); return; }
    setBusy(true);
    let avatar = removeAvatar ? "" : (store.avatar || "");
    try {
      if (avatarFile) {
        avatar = userId ? await uploadAvatar(avatarFile, userId) : await fileToDataURL(avatarFile);
      }
    } catch (e) {
      setErr(e.message || "Couldn't save the picture. Try again.");
      setBusy(false);
      return;
    }
    update({ name: clean, bio: bio.trim().slice(0, BIO_MAX), country, start: Math.min(Date.now(), dd), cc, spend: amount, avatar });
    setBusy(false);
    setEditing(false);
    setFlash("Saved ✓ Your profile is up to date.");
  };

  const prettyDate = store.start
    ? new Date(store.start).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "—";

  const avatarShown = editing
    ? (avatarPreview || (!removeAvatar && store.avatar) || null)
    : (store.avatar || null);

  return (
    <div className="in">
      <h1>Profile</h1>
      {!authed && (
        <div className="card">
          <b>You&apos;re not logged in</b>
          <p className="mu">Log in or create an account to sync your recovery across devices.</p>
          <button className="btn" onClick={() => actions.open("login")} style={{ marginBottom: 8 }}>Log in</button>
          <button className="btn sec" onClick={() => actions.open("signup")}>Sign up</button>
        </div>
      )}

      {!editing ? (
        <div className="card">
          {flash && <p style={{ color: "var(--ac)", fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>{flash}</p>}
          <div className="row" style={{ alignItems: "center", justifyContent: "flex-start", gap: 14 }}>
            {store.avatar
              ? <img className="p-avatar" src={store.avatar} alt="Profile picture" />
              : <span className="p-avatar">{(store.name || "?").trim().charAt(0).toUpperCase()}</span>}
            <span>
              <b style={{ fontSize: 20 }}>{store.name}</b>
              <br />
              <span className="mu">{CO[store.country].n}{store.email ? ` · ${store.email}` : ""}</span>
            </span>
          </div>
          {store.bio ? <p style={{ marginTop: 10 }}>{store.bio}</p> : null}
          <div style={{ marginTop: 14 }}>
            <div className="row"><span className="mu">Recovery started</span><b>{prettyDate}</b></div>
            <div className="row" style={{ marginTop: 8 }}><span className="mu">Days in recovery</span><b>{daysSince(store.start)}</b></div>
            <div className="row" style={{ marginTop: 8 }}><span className="mu">Weekly spend</span><b>{fm(store, store.spend || 0)}</b></div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn sec" onClick={startEdit}>Edit profile</button>
            {store.email && (
              <button className="btn sec" onClick={() => actions.open("confirmLogout")} style={{ marginTop: 8 }}>Log out</button>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <b>Edit profile</b>
          <div style={{ marginTop: 8 }}>
            <div className="row" style={{ alignItems: "center", justifyContent: "flex-start", gap: 12 }}>
              {avatarShown
                ? <img className="p-avatar" src={avatarShown} alt="Profile picture preview" />
                : <span className="p-avatar">{(name || "?").trim().charAt(0).toUpperCase()}</span>}
              <span>
                <label className="chip" style={{ cursor: "pointer", margin: 0 }} htmlFor="avatar-pick">Choose picture</label>
                <input id="avatar-pick" type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => pickFile(e.target.files?.[0])} />
                {(avatarShown || store.avatar) && (
                  <button className="mu" style={{ display: "block", textDecoration: "underline", padding: "8px 0 0" }} onClick={() => { setAvatarFile(null); setAvatarPreview(null); setRemoveAvatar(true); }}>Remove</button>
                )}
              </span>
            </div>
            <label style={{ marginTop: 8 }}>Your name
              <input placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(sanitizeNameInput(e.target.value))} />
            </label>
            <label>Bio (optional)
              <textarea rows={2} maxLength={BIO_MAX} placeholder="Tell the community a little about yourself" value={bio} onChange={(e) => setBio(e.target.value)} />
            </label>
            <p className="mu" style={{ marginTop: -8 }}>{bio.length}/{BIO_MAX}</p>
            <label>Your country
              <select value={country} onChange={(e) => setCountry(e.target.value)}>
                {Object.entries(CO).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
              </select>
            </label>
            <DateField label="Recovery start" value={date} onChange={setDate} />
            <label>Weekly spend</label>
            <div className="row" style={{ gap: 8 }}>
              <select style={{ width: "44%" }} value={cc} onChange={(e) => setCc(e.target.value)}>
                {CUR.map((c) => <option key={c[0]} value={c[0]}>{c[1] !== c[0] ? `${c[0]} (${c[1]})` : c[0]}</option>)}
              </select>
              <input type="text" inputMode="decimal" placeholder="Amount per week" value={spend} onChange={(e) => setSpend(formatAmountInput(e.target.value))} style={{ flex: 1 }} />
            </div>
            {err ? <p style={{ color: "var(--bad)", fontSize: 14, margin: "0 0 8px" }}>{err}</p> : null}
            <button className="btn" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
            <button className="btn sec" onClick={() => { setEditing(false); setErr(""); }} style={{ marginTop: 8 }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <p className="mu">Steady is a recovery-support companion, not a therapist or emergency service. Data stays on this device unless you send a report or request.</p>
        <button className="btn sec" onClick={() => actions.open("wipe")}>Delete all my data</button>
      </div>
    </div>
  );
}
