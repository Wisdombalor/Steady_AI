import { useEffect, useRef, useState } from "react";
import { TRIG, EMO, ACTS, PGSI, CO } from "../lib/data";
import { mmss, daysSince, bestStreak, today, urgeTrigs, urgeEmos, missingPwReqs } from "../lib/helpers";
import { Chips, PasswordInput } from "./Chrome";
import { BackIcon } from "./Icons";
import { PwChecklist } from "./Onboarding";
import { sendReport, createReport } from "../lib/backend";
import { chatReply, aiErrorMessage } from "../lib/ai";

function MultiPick({ options, values, onToggle, placeholder }) {
  const [custom, setCustom] = useState("");
  const customs = values.filter((v) => !options.includes(v));
  const add = () => {
    const v = custom.trim().replace(/\s+/g, " ");
    if (!v) return;
    if (!values.includes(v)) onToggle(v);
    setCustom("");
  };
  return (
    <>
      <div className="chips">
        {options.map((x) => (
          <button key={x} className={"chip " + (values.includes(x) ? "on" : "")} onClick={() => onToggle(x)}>{x}</button>
        ))}
      </div>
      {customs.length > 0 && (
        <div className="chips" style={{ marginTop: 8 }}>
          {customs.map((v) => (
            <button key={v} className="chip on" onClick={() => onToggle(v)}>{v} ×</button>
          ))}
        </div>
      )}
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <input placeholder={placeholder} value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} style={{ flex: 1, margin: 0 }} />
        <button className="chip on" onClick={add} style={{ flex: "none" }}>Add</button>
      </div>
    </>
  );
}

export function UrgeSheet({ draft, setDraft, onContinue, onLogOnly, logged }) {
  const [level, setLevel] = useState(draft.before ?? 5);
  const trigs = urgeTrigs(draft);
  const emos = urgeEmos(draft);
  const toggle = (key, v) => {
    const cur = key === "trigs" ? trigs : emos;
    setDraft({ ...draft, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const loggedTrigs = logged ? urgeTrigs(logged) : [];
  return (
    <>
      <div className="breath" />
      {logged && (
        <p style={{ color: "var(--ac)", fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>
          ✓ Logged{loggedTrigs.length ? `: ${loggedTrigs.join(", ")}` : ""} · {logged.before}/10 · find it in Recovery → Urge history
        </p>
      )}
      <h2>How strong is the urge?</h2>
      <input type="range" min={1} max={10} value={level} onChange={(e) => { setLevel(+e.target.value); setDraft({ ...draft, before: +e.target.value }); }} />
      <p className="big">{level}</p>
      <h2>What&apos;s happening? (pick all that apply)</h2>
      <MultiPick options={TRIG} values={trigs} onToggle={(v) => toggle("trigs", v)} placeholder="Something else… type it here" />
      <h2>How are you feeling? (pick all that apply)</h2>
      <MultiPick options={EMO} values={emos} onToggle={(v) => toggle("emos", v)} placeholder="Another feeling… type it here" />
      <br />
      <button className="btn" onClick={onContinue}>Get support</button>
      <br /><br />
      <button className="btn sec" onClick={onLogOnly}>Just log it</button>
    </>
  );
}

export function HubSheet({ actions }) {
  return (
    <>
      <h2>Let&apos;s get through this moment.</h2>
      <div className="grid">
        <button className="card" onClick={() => actions.open("ai")}>Talk to Beacon</button>
        <button className="card" onClick={() => actions.open("acts")}>Do an activity</button>
        <button className="card" onClick={() => actions.open("call")}>Contact someone</button>
        <button className="card" onClick={() => actions.open("protect")}>Protect me</button>
      </div>
    </>
  );
}

export function ActsSheet({ actIndex, onDone, onSkip, onStop, onStartTimer }) {
  const a = ACTS[actIndex % ACTS.length];
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(a[2]);

  useEffect(() => { setRunning(false); setLeft(a[2]); }, [actIndex, a]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  return (
    <>
      <p className="mu">Activity</p>
      <h2 className="pop">{a[0]}</h2>
      <p>{a[1]}</p>
      <div className="tm">{mmss(left)}</div>
      {!running ? (
        <button className="btn" onClick={() => { setRunning(true); onStartTimer && onStartTimer(); }}>Start</button>
      ) : (
        <>
          <div className="breath" style={{ width: 60, height: 60 }} />
          <button className="btn" onClick={onDone}>{left <= 0 ? "Done — mark as complete" : "Mark as complete"}</button>
        </>
      )}
      <br /><br />
      <button className="btn sec" onClick={onSkip}>Skip this one</button>
      <button className="mu" onClick={onStop} style={{ display: "block", margin: "12px auto 0", padding: "10px 16px", minHeight: 44, textDecoration: "underline" }}>Stop activities</button>
    </>
  );
}

export function CallSheet({ store, actions }) {
  const t = store.trusted[0];
  if (t) {
    return (
      <>
        <h2>Contact {t.n}</h2>
        <a className="btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }} href={`tel:${t.p}`}>Call</a>
        <br />
        <a className="btn sec" style={{ display: "block", textAlign: "center", textDecoration: "none" }} href={`sms:${t.p}?&body=${encodeURIComponent(`Hi ${t.n}, I'm having a tough moment and could use someone to talk to. Can you call or text me?`)}`}>Send a message</a>
      </>
    );
  }
  return (
    <>
      <h2>You haven&apos;t added a trusted person yet</h2>
      <p className="mu">Someone you trust can make hard moments easier.</p>
      <button className="btn" onClick={() => actions.open("trust")}>Add a trusted person</button>
    </>
  );
}

export function TrustSheet({ store, update, actions, editIndex }) {
  const existing = editIndex != null ? store.trusted[editIndex] : null;
  const [n, setN] = useState(existing?.n ?? "");
  const [rel, setRel] = useState(existing?.rel ?? "");
  const [p, setP] = useState(existing?.p ?? "");
  const [err, setErr] = useState("");
  const save = () => {
    const clean = String(n ?? "").trim().replace(/\s+/g, " ");
    const cleanRel = String(rel ?? "").trim().replace(/\s+/g, " ");
    if (!clean) { setErr("Enter their name."); return; }
    if (!/^[\p{L} ]+$/u.test(clean)) { setErr("Please use letters only for the name — no numbers or symbols."); return; }
    if (cleanRel && !/^[\p{L} ]+$/u.test(cleanRel)) { setErr("Please use letters only for the relationship — no numbers or symbols."); return; }
    if (!/^\+?[0-9\s\-()]+$/.test(p.trim()) || p.replace(/\D/g, "").length < 7 || p.replace(/\D/g, "").length > 15) {
      setErr("Enter a valid phone number using digits only, e.g. 08012345678 or +2348012345678."); return;
    }
    const contact = { n: clean, rel: cleanRel, p: p.replace(/[\s\-()]/g, "") };
    if (editIndex != null) {
      update((prev) => ({ trusted: prev.trusted.map((t, i) => (i === editIndex ? contact : t)) }));
    } else {
      update({ trusted: [...store.trusted, contact] });
    }
    actions.close();
  };
  return (
    <>
      <h2>{editIndex != null ? "Edit trusted person" : "Add a trusted person"}</h2>
      <input placeholder="Name" value={n} onChange={(e) => setN(String(e.target.value).replace(/[^\p{L} ]/gu, ""))} />
      <input placeholder="Relationship" value={rel} onChange={(e) => setRel(String(e.target.value).replace(/[^\p{L} ]/gu, ""))} />
      <input type="tel" inputMode="tel" placeholder="Phone number" value={p} onChange={(e) => setP(e.target.value)} />
      <p style={{ color: "var(--bad)", fontSize: 14, minHeight: 20, margin: "0 0 8px" }}>{err}</p>
      <button className="btn" onClick={save}>{editIndex != null ? "Save changes" : "Save"}</button>
    </>
  );
}

export function ProfileSheet({ post, store, actions }) {
  const mine = !!post.mine;
  const reportable = !mine && post.v !== "anon" && (post.au || post.n);
  const av = post.av || (mine ? store.avatar : null);
  const name = post.n || store.name || "Member";
  const bio = post.bio || (mine ? store.bio : "");
  const beaten = mine
    ? store.urges.filter((u) => u.after != null && u.after < u.before).length
    : null;
  const more = mine
    ? store.posts.filter((x) => x.mine && x.id !== post.id).slice(0, 3)
    : (post.n ? store.posts.filter((x) => x.n === post.n && x.id !== post.id && x.v !== "anon").slice(0, 3) : []);
  return (
    <>
      <div className="row" style={{ alignItems: "center", justifyContent: "flex-start", gap: 14 }}>
        {av
          ? <img className="pv-avatar" src={av} alt="" />
          : <span className="pv-avatar">{(name || "?").trim().charAt(0).toUpperCase()}</span>}
        <span>
          <b style={{ fontSize: 20 }}>{name}</b>
          <br />
          <span className="mu">{post.stage || ""}{mine ? " · you" : ""}</span>
        </span>
      </div>
      {bio ? <p style={{ marginTop: 10 }}>{bio}</p> : <p className="mu" style={{ marginTop: 10 }}>{mine ? "No bio yet — add one from your Profile." : "No bio yet."}</p>}
      <div className="grid" style={{ marginTop: 12 }}>
        <div className="card stat">
          <b>{mine ? `${daysSince(store.start)}` : post.day != null ? `${post.day}` : "—"}</b>
          <span className="mu">{mine ? "Day streak" : "Day streak when posted"}</span>
        </div>
        {mine && (
          <>
            <div className="card stat"><b>{bestStreak(store)}</b><span className="mu">Longest (days)</span></div>
            <div className="card stat"><b>{beaten}</b><span className="mu">Urges beaten</span></div>
          </>
        )}
      </div>
      {more.length > 0 && (
        <>
          <h2>{mine ? "Your recent posts" : `Recent posts by ${name}`}</h2>
          {more.map((x) => (
            <div className="card" key={x.id}>
              <p style={{ margin: 0 }}>{x.t}</p>
              <span className="mu">{new Date(x.d).toLocaleDateString()} · {x.stage}</span>
            </div>
          ))}
        </>
      )}
      {reportable && actions && (
        <button className="btn sec" style={{ marginTop: 8 }} onClick={() => actions.open("repUser", { userId: post.au || null, name })}>Report user</button>
      )}
    </>
  );
}

export function RulesSheet({ onAgree }) {
  return (
    <>
      <h2>Community rules</h2>
      <p className="mu">No gambling promotion or betting tips. Don&apos;t encourage anyone to gamble. Don&apos;t shame relapse. Respect anonymity. No harassment. Don&apos;t pose as a professional. Report anything that breaks these rules.</p>
      <button className="btn" onClick={onAgree}>I agree</button>
    </>
  );
}

export function PostSheet({ store, user, onPost, actions }) {
  const [t, setT] = useState("");
  const [v, setV] = useState("me");
  const [err, setErr] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!t.trim()) return;
    if (v !== "me" && !user) {
      setErr("Log in or sign up to share with the community. You can still post privately.");
      setNeedsAuth(true);
      return;
    }
    setBusy(true);
    const msg = await onPost(t.trim(), v);
    setBusy(false);
    if (msg) setErr(msg);
  };
  return (
    <>
      <h2>Share your story</h2>
      <textarea rows={4} placeholder="What helped today?" value={t} onChange={(e) => setT(e.target.value)} />
      <label>Who can see this?
        <select value={v} onChange={(e) => { setV(e.target.value); setNeedsAuth(false); setErr(""); }}>
          <option value="me">Only me</option>
          <option value="com">Public</option>
        </select>
      </label>
      <p className="mu">Public posts show your name to the whole community. Only me stays on this device.</p>
      <p style={{ color: "var(--bad)", fontSize: 14, minHeight: 20, margin: "0 0 8px" }}>{err}</p>
      <button className="btn" disabled={busy} onClick={submit}>{busy ? "Posting…" : "Post"}</button>
      {needsAuth && !user && actions && (
        <>
          <button className="btn sec" onClick={() => actions.open("login")} style={{ marginTop: 8 }}>Log in</button>
          <button className="btn sec" onClick={() => actions.open("signup")} style={{ marginTop: 8 }}>Sign up</button>
        </>
      )}
    </>
  );
}

export function FiltersSheet({ filters, setFilters, onApply }) {
  const [f, setF] = useState(filters);
  return (
    <>
      <h2>Filters</h2>
      <p className="mu">When it was posted</p>
      <Chips options={["all","Newest","Today","This week","This month","Older"]} value={f.time} onPick={(x) => setF({ ...f, time: x })} />
      <p className="mu" style={{ marginTop: 16 }}>Recovery period</p>
      <Chips options={["all","Starting out","1–7 days","8–30 days","31–90 days","3–6 months","6–12 months","1+ year"]} value={f.stage} onPick={(x) => setF({ ...f, stage: x })} />
      <br />
      <button className="btn" onClick={() => { setFilters(f); onApply(); }}>Show posts</button>
    </>
  );
}

export function DeleteSheet({ onConfirm, onCancel, title, body }) {
  return (
    <div className="confirm-in">
      <h2>{title ?? "Delete this post?"}</h2>
      <p className="mu">{body ?? "It will be permanently removed. This cannot be undone."}</p>
      <button className="btn" style={{ background: "var(--bad)" }} onClick={onConfirm}>Yes, delete</button>
      <br /><br />
      <button className="btn sec" onClick={onCancel}>Cancel</button>
    </div>
  );
}

// Generic "are you sure?" step before a major action (log out, etc.).
export function ConfirmSheet({ title, body, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="confirm-in">
      <h2>{title}</h2>
      {body ? <p className="mu">{body}</p> : null}
      <button className="btn" style={danger ? { background: "var(--bad)" } : null} onClick={onConfirm}>{confirmLabel || "Confirm"}</button>
      <br /><br />
      <button className="btn sec" onClick={onCancel}>Cancel</button>
    </div>
  );
}

const POST_REASONS = ["Gambling promotion","Harassment","Self-harm content","Spam","Other"];
const USER_REASONS = ["Harassment","Impersonation","Spam","Harmful content","Other"];

// DB-backed reporting. target = { kind: "post", post } | { kind: "user", userId, name }.
export function ReportSheet({ target, reporterId, blocked, store, update, actions }) {
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const isPost = target?.kind === "post";
  const send = async (reason) => {
    if (blocked) { setErr("Your account is suspended, so you can't file reports right now."); return; }
    setPending(null);
    setSending(true);
    setErr("");
    try {
      if (isPost) {
        await createReport({ reporterId, kind: "post", reason, post: target.post });
        if (!store.hidden.includes(target.post.id)) update({ hidden: [...store.hidden, target.post.id] });
      } else {
        await createReport({ reporterId, kind: "user", reason, userId: target.userId, userName: target.name });
      }
      setDone(true);
    } catch (e) {
      setErr("Couldn't submit the report. " + friendlyDbError(e));
    }
    setSending(false);
  };
  if (sending) return <h2>Sending…</h2>;
  if (done) {
    return (
      <>
        <h2>Report submitted.</h2>
        {isPost && <p className="mu">The post is now hidden for you.</p>}
        <button className="btn" onClick={actions.close}>Done</button>
      </>
    );
  }
  return (
    <>
      <h2>{isPost ? "Report post" : `Report ${target?.name || "user"}`}</h2>
      <p className="mu">Why are you reporting this?</p>
      {(isPost ? POST_REASONS : USER_REASONS).map((r) => (
        <button key={r} className="btn sec" style={{ marginBottom: 8 }} onClick={() => setPending(r)}>{r}</button>
      ))}
      {pending && (
        <div className="card confirm-in" style={{ marginTop: 4 }}>
          <b>Report for “{pending}”?</b>
          <p className="mu" style={{ margin: "4px 0 8px" }}>
            {isPost ? "The moderation team will review this post." : "The moderation team will review this user."}
          </p>
          <button className="btn" onClick={() => send(pending)}>Send report</button>
          <button className="btn sec" style={{ marginTop: 8 }} onClick={() => setPending(null)}>Cancel</button>
        </div>
      )}
      {err ? <p style={{ color: "var(--bad)", fontSize: 14 }}>{err}</p> : null}
    </>
  );
}

export function friendlyDbError(e) {
  const m = String(e?.message || "");
  if (/row-level security|policy|permission|not allowed|42501/i.test(m)) return "Your account isn't allowed to do that.";
  if (/Failed to fetch|Network|network/i.test(m)) return "Check your connection and try again.";
  if (/Could not find the table|schema cache|PGRST205/i.test(m)) return "The community database isn't set up yet — ask the app owner to run supabase/schema.sql.";
  return m || "Please try again.";
}

export function RequestSheet({ store, update, actions }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [pref, setPref] = useState("Email");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [state, setState] = useState("form");
  const [ok, setOk] = useState(false);

  const submit = async () => {
    if (!name.trim()) { setErr("Enter your name."); return; }
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.trim());
    const phoneOk = /^\+?[0-9\s\-()]+$/.test(contact.trim()) && contact.replace(/\D/g, "").length >= 7;
    if (!emailOk && !phoneOk) { setErr("Enter a valid email address or phone number."); return; }
    setState("sending");
    const sent = await sendReport("Steady: new support request",
      { name, contact, preferred: pref, message: msg, country: CO[store.country].n },
      (o) => update({ outbox: [...store.outbox, o] }));
    setOk(sent);
    setState("done");
  };

  if (state === "sending") {
    return (
      <>
        <h2>Sending your request…</h2>
        <p className="mu">Please wait a moment.</p>
        <span className="tdots" aria-label="Sending"><i /><i /><i /></span>
      </>
    );
  }
  if (state === "done") {
    return ok ? (
      <div className="confirm-in">
        <h2>Request sent</h2>
        <p className="mu">Thanks, {name.trim() || "friend"}. We&apos;ll be in touch via {pref.toLowerCase()}.</p>
        <button className="btn" onClick={actions.close}>Done</button>
      </div>
    ) : (
      <div className="confirm-in">
        <h2>Couldn&apos;t send it</h2>
        <p className="mu">We couldn&apos;t reach the support service. Your request is saved on this device and will be sent automatically once you&apos;re back online.</p>
        <button className="btn" onClick={() => { setState("form"); }}>Try again</button>
        <button className="btn sec" style={{ marginTop: 8 }} onClick={actions.close}>Done</button>
      </div>
    );
  }
  return (
    <>
      <h2>Request support</h2>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Email or phone" value={contact} onChange={(e) => setContact(e.target.value)} />
      <label>How should we contact you?
        <select value={pref} onChange={(e) => setPref(e.target.value)}><option>Email</option><option>Phone call</option><option>Both</option></select>
      </label>
      <textarea rows={3} placeholder="What would you like help with?" value={msg} onChange={(e) => setMsg(e.target.value)} />
      <p style={{ color: "var(--bad)", fontSize: 14, minHeight: 20, margin: "0 0 8px" }}>{err}</p>
      <button className="btn" onClick={submit}>Request support</button>
    </>
  );
}

export function RelapseSheet({ onNew, onClose }) {
  return (
    <>
      <h2>You haven&apos;t lost your progress.</h2>
      <p>A relapse is information, not punishment. Your history stays here.</p>
      <button className="btn" onClick={onNew}>Start a new recovery period</button>
      <br /><br />
      <button className="btn sec" onClick={onClose}>Not now</button>
    </>
  );
}

export function WipeSheet({ onConfirm, onCancel }) {
  const [ack, setAck] = useState(false);
  return (
    <div className="confirm-in">
      <h2>Delete all your data?</h2>
      <p className="mu">Your name, recovery dates, urge history, posts and contacts will be removed from this device. This cannot be undone.</p>
      <label className="ack">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>I understand my data will be permanently deleted.</span>
      </label>
      <button className="btn" style={{ background: "var(--bad)", opacity: ack ? 1 : 0.5 }} disabled={!ack} onClick={onConfirm}>Delete everything</button>
      <br /><br />
      <button className="btn sec" onClick={onCancel}>Cancel</button>
    </div>
  );
}

export function CheckSheet({ store, update, actions }) {
  const [mood, setMood] = useState(5);
  const [urge, setUrge] = useState(3);
  const [note, setNote] = useState("");
  const save = () => {
    update({ checks: [...store.checks.filter((x) => x.day !== today()), { day: today(), mood, urge, note: note.trim() }] });
    actions.close();
  };
  return (
    <>
      <h2>Daily check-in</h2>
      <label>Mood: <b>{mood}</b>/10<input type="range" min={1} max={10} value={mood} onChange={(e) => setMood(+e.target.value)} /></label>
      <label>Urge level: <b>{urge}</b>/10<input type="range" min={1} max={10} value={urge} onChange={(e) => setUrge(+e.target.value)} /></label>
      <textarea rows={2} placeholder="Anything you'd like to record? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn" onClick={save}>Save check-in</button>
    </>
  );
}

export function SelfCheckSheet({ onDone }) {
  const [i, setI] = useState(0);
  const [sc, setSc] = useState([]);
  if (i >= 9) return null;
  return (
    <>
      <p className="mu">Question {i + 1} of 9 · in the last 12 months</p>
      <h2>{PGSI[i]}</h2>
      {["Never","Sometimes","Most of the time","Almost always"].map((o, k) => (
        <button key={o} className="btn sec" style={{ marginBottom: 8 }} onClick={() => {
          const next = [...sc, k];
          if (i + 1 >= 9) onDone(next.reduce((a, b) => a + b, 0));
          else { setSc(next); setI(i + 1); }
        }}>{o}</button>
      ))}
    </>
  );
}

export function SelfResult({ score, done, actions }) {
  const m = score === 0 ? ["Lower concern","Your answers don't currently suggest significant gambling-related harm. If you're still concerned, the resources below can help."]
    : score < 3 ? ["Some low-level concern","Your answers suggest gambling may be having a small impact. It may be worth watching your patterns."]
    : score < 8 ? ["Some concern","Your answers suggest gambling may be having an impact on your life. It may be worth taking a closer look at your gambling patterns."]
    : ["Significant concern","Your answers suggest you may be experiencing significant gambling-related harm. Consider speaking with a professional or support service."];
  return (
    <>
      <h2>{m[0]}</h2>
      <p>{m[1]}</p>
      <p className="mu">This is a screening tool, not a diagnosis. Score {score} of 27 (PGSI).</p>
      <button className="btn" onClick={() => { done ? actions.open("ai") : actions.nextOb(); }}>{done ? "Talk to Beacon" : "Continue setup"}</button>
      <br /><br />
      {done ? <button className="btn sec" onClick={() => actions.open("protect")}>Protect me</button> : null}
    </>
  );
}

export function ReassessSheet({ onPick }) {
  return (
    <>
      <h2>How are you feeling now?</h2>
      {[["My urge is gone",0],["It's lower",1],["It's still strong",2],["It's getting worse",3]].map(([label, v]) => (
        <button key={label} className="btn sec" style={{ marginBottom: 8 }} onClick={() => onPick(v)}>{label}</button>
      ))}
    </>
  );
}

export function ReassessResult({ level, actions }) {
  if (level === 0) return (<><h2 className="pop">You handled it.</h2><p>That&apos;s saved so you can see what works for you.</p><button className="btn" onClick={actions.close}>Done</button></>);
  if (level === 1) return (<><h2>It&apos;s lower. Good.</h2><button className="btn" onClick={() => actions.open("acts")}>Keep going</button><br /><br /><button className="btn sec" onClick={actions.close}>Finish</button></>);
  return (
    <>
      <h2>You can keep going.</h2>
      <p>{level === 3 ? "Let's bring another layer of support in." : "More support is available."}</p>
      <button className="btn" onClick={() => actions.open("acts")}>More activities</button><br /><br />
      <button className="btn sec" onClick={() => actions.open("ai")}>Talk to Beacon</button><br /><br />
      <button className="btn sec" onClick={() => actions.open("call")}>Call a trusted person</button><br /><br />
      <button className="btn sec" onClick={() => actions.goTab("sup")}>Emergency &amp; counselling lines</button>
    </>
  );
}

const AI_QUICK = ["I really want to bet right now","I'm bored and restless","I relapsed","Help me find a trigger"];
const AI_GREETING = (name) => `Hi ${name}, I'm Beacon. I'm here for the next few minutes, not to fix everything. What's going on right now?`;

export function AiSheet({ store, update }) {
  const chats = store.chats || [];
  const [activeId, setActiveId] = useState(() => (chats.length ? chats[chats.length - 1].id : null));
  const [view, setView] = useState("thread");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  // Resting state: Gemini quota exhausted. Timestamp (ms) when Beacon may be
  // back, or Infinity when the reset time is unknown (daily quota).
  const [restoreAt, setRestoreAt] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const resting = restoreAt != null && nowMs < restoreAt;
  useEffect(() => {
    if (!resting) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNowMs(n);
      if (restoreAt !== Infinity && n >= restoreAt) setRestoreAt(null);
    }, 15000);
    return () => clearInterval(t);
  }, [resting, restoreAt]);
  const restMsg = !resting ? null : (restoreAt === Infinity
    ? "Today's AI limit is reached. Back after midnight Pacific."
    : `Back in about ${Math.max(1, Math.ceil((restoreAt - nowMs) / 60000))} min.`);
  const boxRef = useRef(null);

  const active = chats.find((c) => c.id === activeId) || null;
  const msgs = active ? active.msgs : [];

  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }, [msgs, busy, view]);

  const appendMsgs = (id, added) => update((prev) => ({
    chats: (prev.chats || []).map((c) => (c.id === id ? { ...c, msgs: [...c.msgs, ...added].slice(-60) } : c)).slice(-20),
  }));

  const ensureConvo = (t) => {
    if (activeId) return { id: activeId, convoMsgs: msgs };
    const id = "c" + Date.now();
    const rec = { id, title: t.slice(0, 42), created: Date.now(), days: daysSince(store.start), msgs: [{ r: "u", t }] };
    update((prev) => ({ chats: [...(prev.chats || []), rec].slice(-20) }));
    setActiveId(id);
    return { id, convoMsgs: rec.msgs };
  };

  const send = async (text) => {
    const t = (text ?? input).trim();
    if (!t || busy || resting) return;
    setInput("");
    const { id, convoMsgs } = ensureConvo(t);
    if (/suicid|kill myself|end my life|self.harm|hurt myself|want to die/i.test(t)) {
      appendMsgs(id, [{ r: "a", t: "This sounds like an emergency. Your life matters — please reach out right now:\n" + CO[store.country].r.map((x) => x.o + ": " + x.p).join("\n") + "\nGlobal support: Gambling Therapy (gamblingtherapy.org) · Gamblers Anonymous (gamblersanonymous.org)" }]);
      return;
    }
    if (activeId) appendMsgs(id, [{ r: "u", t }]);
    setBusy(true);
    try {
      const last = convoMsgs[convoMsgs.length - 1];
      const hist = last && last.r === "u" && last.t === t ? convoMsgs.slice(0, -1) : convoMsgs;
      const res = await chatReply({ message: t, history: hist });
      if (res.unavailable) {
        // Out of tokens: park Beacon instead of looping saved replies.
        const s = res.retryAfterSeconds;
        setRestoreAt(s > 0 && s < 6 * 3600 ? Date.now() + s * 1000 : Infinity);
        appendMsgs(id, [{ r: "a", t: "Beacon is resting right now — the AI limit is reached, so I'm pausing replies instead of repeating myself. Your message is saved above. Try an urge activity or call someone you trust in the meantime." }]);
      } else {
        appendMsgs(id, [{ r: "a", t: res.fallback ? res.text + "\n\n(Saved reply — Beacon is offline right now.)" : res.text }]);
      }
    } catch (e) {
      appendMsgs(id, [{ r: "a", t: aiErrorMessage(e) }]);
    }
    setBusy(false);
  };

  const newChat = () => { setActiveId(null); setView("thread"); setInput(""); };
  const openChat = (id) => { setActiveId(id); setView("thread"); };
  const delChat = (id) => {
    update((prev) => ({ chats: (prev.chats || []).filter((c) => c.id !== id) }));
    if (id === activeId) { setActiveId(null); setView("list"); }
    setConfirmDel(null);
  };

  if (view === "list") {
    return (
      <div className="ai-wrap">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Beacon chats</h2>
          <button className="chip on" onClick={newChat}>+ New</button>
        </div>
        <p className="mu">Every conversation keeps the streak you had when you started it.</p>
        <div className="ai-chat">
          {chats.slice().reverse().map((c) => (
            <div className="card row" key={c.id}>
              <button style={{ flex: 1, textAlign: "left", minWidth: 0 }} onClick={() => openChat(c.id)}>
                <b className="chat-title">{c.title || "Conversation"}</b>
                <span className="mu">Day {c.days} · {new Date(c.created).toLocaleDateString()} · {c.msgs.length} messages</span>
              </button>
              {confirmDel === c.id ? (
                <span style={{ display: "flex", gap: 4, flex: "none" }}>
                  <button className="mu" style={{ color: "var(--bad)", textDecoration: "underline", padding: 8 }} onClick={() => delChat(c.id)}>Confirm</button>
                  <button className="mu" style={{ textDecoration: "underline", padding: 8 }} onClick={() => setConfirmDel(null)}>Keep</button>
                </span>
              ) : (
                <button className="mu" style={{ textDecoration: "underline", padding: 8 }} onClick={() => setConfirmDel(c.id)}>Delete</button>
              )}
            </div>
          ))}
          {!chats.length && <p className="mu">No conversations yet. Start one below.</p>}
        </div>
        <div className="ai-input">
          <button className="btn" style={{ width: "100%" }} onClick={newChat}>Start a new conversation</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-wrap">
      <div className="row" style={{ alignItems: "center" }}>
        <button className="chip" onClick={() => setView("list")} aria-label="Back to all chats"><BackIcon /> All chats</button>
        <span className="mu">{active ? `Day ${active.days}` : "New chat"}</span>
        <button className="chip on" onClick={newChat}>+ New</button>
      </div>
      <div ref={boxRef} id="chat" className="ai-chat">
        {!msgs.length && <div className="msg a">{AI_GREETING(store.name)}</div>}
        {msgs.map((m, i) => <div key={i} className={"msg " + m.r}>{m.t}</div>)}
        {busy && <div className="msg a"><span className="tdots" aria-label="Beacon is typing"><i /><i /><i /></span></div>}
      </div>
      <div className="ai-quick">
        {AI_QUICK.map((q) => (
          <button key={q} className="chip" disabled={resting} onClick={() => send(q)}>{q}</button>
        ))}
      </div>
      {resting && (
        <div className="card" style={{ marginBottom: 8 }}>
          <b>Beacon is resting</b>
          <p className="mu" style={{ margin: "4px 0 8px" }}>{restMsg} Urge activities and trusted contacts still work.</p>
          <button className="chip" onClick={() => { setRestoreAt(null); setNowMs(Date.now()); }}>Try anyway</button>
        </div>
      )}
      <div className="ai-input">
        <input placeholder={resting ? "Beacon is resting…" : "Message Beacon"} disabled={resting} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        <button className="btn" onClick={() => send()} disabled={busy || resting}>{busy ? "Thinking…" : "Send"}</button>
      </div>
    </div>
  );
}

export function SetPwSheet({ onSave }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  return (
    <>
      <h2>Set a new password</h2>
      <PasswordInput autoComplete="new-password" placeholder="New password" value={v} onChange={(e) => setV(e.target.value)} />
      <PwChecklist pw={v} />
      <p style={{ color: "var(--bad)", minHeight: 20, margin: "0 0 8px" }}>{err}</p>
      <button className="btn" onClick={async () => {
        const missing = missingPwReqs(v);
        if (missing.length) { setErr("Password is too weak — it needs: " + missing.join(", ") + "."); return; }
        const msg = await onSave(v);
        if (msg) setErr(msg);
      }}>Save password</button>
    </>
  );
}
