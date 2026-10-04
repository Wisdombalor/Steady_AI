import { useEffect, useState } from "react";
import { MOT } from "../lib/data";
import { elapsed, daysSince, moneySaved, bestStreak, fm, today, urgeTrigs } from "../lib/helpers";

export function useTick(active, ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [active, ms]);
}

export function Counter({ store }) {
  useTick(!!store.start);
  const t = Math.floor(elapsed(store.start) / 1e3);
  const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), x = t % 60;
  return (
    <>
      <div className="hero"><b>{d}</b><span>{d === 1 ? "day" : "days"}</span></div>
      <p className="sub">{h} hr {m} min {x} sec</p>
    </>
  );
}

export function CheckCard({ store, onCheck }) {
  const c = store.checks.find((x) => x.day === today());
  if (c) return <div className="card"><b>Today&apos;s check-in done</b><p className="mu" style={{ margin: "4px 0 0" }}>Mood {c.mood}/10 · Urge {c.urge}/10</p></div>;
  return <div className="card"><b>How are you doing today?</b><p className="mu">A 20-second check-in helps you see patterns.</p><button className="btn sec" onClick={() => onCheck("check")}>Check in</button></div>;
}

export function Home({ store, actions }) {
  const h = new Date().getHours();
  const g = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  const ok = store.urges.filter((u) => u.after != null && u.after < u.before).length;
  return (
    <div className="in">
      <h1>Good {g}, {store.name}</h1>
      <div id="ctr"><Counter store={store} /><p className="saved">Saved so far <b>{fm(store, moneySaved(store))}</b></p></div>
      <CheckCard store={store} onCheck={actions.open} />
      <button className="urge" onClick={() => actions.open("urge")}>I&apos;m having an urge</button>
      <div className="grid">
        <button className="card" onClick={() => actions.open("ai")}>Talk to Beacon</button>
        <button className="card" onClick={() => actions.open("acts")}>Do an activity</button>
        <button className="card" onClick={() => actions.open("call")}>Call someone</button>
        <button className="card" onClick={() => actions.open("protect")}>Protect me</button>
      </div>
      <div className="grid" style={{ marginTop: 12 }}>
        <div className="card stat"><b>{store.urges.length}</b><span className="mu">Urges logged</span></div>
        <div className="card stat"><b>{ok}</b><span className="mu">Urge went down</span></div>
        <div className="card stat"><b>{bestStreak(store)}</b><span className="mu">Longest (days)</span></div>
      </div>
      {store.test == null && (
        <div className="card"><b>Not sure if gambling is a problem?</b><p className="mu">Take a 2-minute self-check.</p><button className="btn sec" onClick={() => actions.open("selfcheck")}>Take the self-check</button></div>
      )}
      <div className="card"><b>Today&apos;s reminder</b><p className="mu">{MOT[new Date().getDate() % MOT.length]}</p></div>
    </div>
  );
}

export function Insights({ store }) {
  const u = store.urges, ch = store.checks.slice(-7);
  let mood = null, patterns = null;
  if (ch.length) {
    mood = (
      <>
        <h2>Last {ch.length} check-ins</h2>
        <div className="card"><span className="mu">Mood</span>
          <div className="bars">{ch.map((c) => <i key={c.day} title={`${c.day}: ${c.mood}`} style={{ height: `${c.mood * 10}%` }} />)}</div>
          <span className="mu">Urge level</span>
          <div className="bars">{ch.map((c) => <i key={c.day} title={`${c.day}: ${c.urge}`} style={{ height: `${c.urge * 10}%`, background: "var(--warn)" }} />)}</div>
        </div>
      </>
    );
  }
  if (u.length >= 3) {
    const cnt = (f) => { const m = {}; u.forEach((x) => { const k = f(x); if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const cntArr = (f) => { const m = {}; u.forEach((x) => { f(x).forEach((k) => { if (k) m[k] = (m[k] || 0) + 1; }); }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const tr = cntArr(urgeTrigs).slice(0, 3);
    const mx = tr[0] ? tr[0][1] : 1;
    const part = cnt((x) => { const hh = new Date(x.t).getHours(); return hh < 6 ? "late night" : hh < 12 ? "morning" : hh < 18 ? "afternoon" : "evening"; })[0];
    const dow = cnt((x) => ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(x.t).getDay()])[0];
    const done = u.filter((x) => x.after != null);
    const dn = done.filter((x) => x.after < x.before).length;
    patterns = (
      <>
        <h2>Your patterns</h2>
        <div className="card">
          {tr.map((t) => (
            <div key={t[0]}>
              <div className="row"><span>{t[0]}</span><span className="mu">{t[1]}×</span></div>
              <div className="bar"><i style={{ width: `${(t[1] / mx) * 100}%` }} /></div>
            </div>
          ))}
          <p className="mu" style={{ margin: 0 }}>Urges are most common in the <b>{part[0]}</b>{dow ? <> and on <b>{dow[0]}s</b></> : null}.{done.length ? <> The urge dropped in {Math.round((dn / done.length) * 100)}% of the ones you worked through.</> : null}</p>
        </div>
      </>
    );
  }
  return <>{mood}{patterns}</>;
}
