import { CO, SX, BL } from "../lib/data";
import { BackIcon } from "./Icons";

export function Support({ store, update, actions }) {
  const c = CO[store.country];
  return (
    <div className="in">
      <h1>Support</h1>
      <select value={store.country} onChange={(e) => update({ country: e.target.value })}>
        {Object.entries(CO).map(([k, v]) => <option key={k} value={k}>{v.n}</option>)}
      </select>
      <p className="mu">Numbers can change. Confirm any line before relying on it.</p>
      {c.r.map((x) => (
        <div className="card" key={x.o}><b>{x.o}</b><p className="mu">{x.d}</p><a className="tel" href={`tel:${x.p.replace(/[^+*\d]/g, "")}`}>Call {x.p}</a></div>
      ))}
      <h2>Trusted people</h2>
      {store.trusted.map((t, i) => (
        <div className="card" key={i}>
          <div className="row"><span>{t.n} <span className="mu">{t.rel}</span></span><a className="tel" href={`tel:${t.p.replace(/[^+\d]/g, "")}`}>Call</a></div>
          <div className="row" style={{ marginTop: 8 }}>
            <span>
              <button className="mu" style={{ textDecoration: "underline", padding: "8px 8px 8px 0" }} onClick={() => actions.open("trust", { index: i })}>Edit</button>
              <button className="mu" style={{ textDecoration: "underline", padding: 8 }} onClick={() => actions.open("delTrust", { index: i })}>Delete</button>
            </span>
          </div>
        </div>
      ))}
      {!store.trusted.length && <p className="mu">You don&apos;t have anyone linked yet.</p>}
      <button className="btn sec" onClick={() => actions.open("trust")}>Add a trusted person</button>
      <h2>Protect me</h2>
      <button className="btn" onClick={() => actions.open("protect")}>Gambling blockers for {c.n}</button>
      <h2>Talk to Steady Support</h2>
      <button className="btn sec" onClick={() => actions.open("req")}>Request support</button>
    </div>
  );
}

export function Protect({ store, onBack }) {
  const c = CO[store.country];
  return (
    <div className="in">
      <button className="chip" onClick={onBack}><BackIcon /> Back</button>
      <h1>Protect me</h1>
      <p className="mu">Blockers for {c.n}. Install one on every device, then ask someone you trust to hold the password.</p>
      {(SX[store.country] || []).map((x) => (
        <div className="card" key={x[0]}><b>{x[0]} · self-exclusion</b><p className="mu">{x[2]}</p><a className="tel" href={x[1]} target="_blank" rel="noreferrer">Visit {x[0]}</a></div>
      ))}
      {BL.map((b) => (
        <div className="card" key={b[0]}><b>{b[0]}</b><p className="mu">{b[2]}</p>
          <ol>{b[3].map((s) => <li key={s}>{s}</li>)}</ol>
          {b[1] ? <a className="tel" href={b[1]} target="_blank" rel="noreferrer">Open {b[0]}</a> : null}
        </div>
      ))}
      <p className="mu">Features and prices change. Check each site.</p>
    </div>
  );
}
