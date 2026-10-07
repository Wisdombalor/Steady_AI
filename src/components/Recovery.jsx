import { useState } from "react";
import { daysSince, moneySaved, bestStreak, fm, urgeTrigs, urgeEmos } from "../lib/helpers";
import { Chips } from "./Chrome";
import { Insights, StartDateNudge } from "./Home";

const DAY = 864e5;

export function Recovery({ store, actions }) {
  const [fOutcome, setFOutcome] = useState("all");
  const [fTrig, setFTrig] = useState("all");
  const [fTime, setFTime] = useState("all");

  const counts = {};
  store.urges.forEach((u) => { urgeTrigs(u).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }); });
  const trigOpts = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const now = Date.now();
  const sod = new Date(); sod.setHours(0, 0, 0, 0);

  const filtered = store.urges
    .slice()
    .reverse()
    .filter((u) => {
      if (fOutcome === "down" && !(u.after != null && u.after < u.before)) return false;
      if (fOutcome === "open" && u.after != null) return false;
      if (fTrig !== "all" && !urgeTrigs(u).includes(fTrig)) return false;
      if (fTime === "Today" && u.t < sod.getTime()) return false;
      if (fTime === "This week" && u.t < now - 7 * DAY) return false;
      if (fTime === "This month" && u.t < now - 30 * DAY) return false;
      return true;
    });

  const active = (fOutcome !== "all") + (fTrig !== "all") + (fTime !== "all");
  const clear = () => { setFOutcome("all"); setFTrig("all"); setFTime("all"); };

  return (
    <div className="in">
      <h1>Recovery</h1>
      {store.start ? (
      <div className="grid">
        <div className="card stat"><b>{daysSince(store.start)}</b><span className="mu">Current days</span></div>
        <div className="card stat"><b>{bestStreak(store)}</b><span className="mu">Longest</span></div>
        <div className="card stat"><b>{fm(store, moneySaved(store))}</b><span className="mu">Saved</span></div>
      </div>
      ) : (
      <StartDateNudge actions={actions} />
      )}
      <p className="mu">A hard day doesn&apos;t erase progress. Every period is kept.</p>
      <Insights store={store} />
      <div className="row">
        <h2 style={{ margin: "30px 0 10px" }}>Urge history</h2>
        <button className="chip on" onClick={() => actions.open("urge")}>Log an urge</button>
      </div>
      {store.urges.length ? (
        <>
          <p className="mu">Outcome</p>
          <Chips options={["all", "Went down", "Open"]} value={fOutcome === "down" ? "Went down" : fOutcome === "open" ? "Open" : "all"} onPick={(x) => setFOutcome(x === "Went down" ? "down" : x === "Open" ? "open" : "all")} />
          {trigOpts.length > 0 && (
            <>
              <p className="mu" style={{ marginTop: 12 }}>Trigger</p>
              <Chips options={["all", ...trigOpts]} value={fTrig} onPick={setFTrig} />
            </>
          )}
          <p className="mu" style={{ marginTop: 12 }}>When</p>
          <Chips options={["all", "Today", "This week", "This month"]} value={fTime} onPick={setFTime} />
          <p className="mu" style={{ marginTop: 12 }}>
            Showing {filtered.length} of {store.urges.length} urge{store.urges.length === 1 ? "" : "s"}
            {active ? <> <button className="tel" onClick={clear}>Clear filters ({active})</button></> : null}
          </p>
          {filtered.map((u, i) => (
            <div className="card" key={u.t + "-" + i}>
              <div className="row"><b>{urgeTrigs(u).join(" · ") || "Urge"}</b><span className="mu">{u.before}{u.after != null ? " → " + u.after : ""} / 10</span></div>
              <span className="mu">{new Date(u.t).toLocaleString()}{urgeEmos(u).length ? ` · ${urgeEmos(u).join(" · ")}` : ""}</span>
            </div>
          ))}
          {!filtered.length && <p className="mu">No urges match these filters. <button className="tel" onClick={clear}>Clear filters</button></p>}
        </>
      ) : <p className="mu">No urges logged yet.</p>}
      <button className="btn sec" onClick={() => actions.open("relapse")}>I relapsed</button>
    </div>
  );
}
