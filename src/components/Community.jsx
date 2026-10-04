import { FilterIcon } from "./Icons";

export function Community({ store, filters, setFilters, onOpen }) {
  const n = (filters.time !== "all") + (filters.stage !== "all");
  const now = Date.now(), D = 864e5;
  const tf = {
    Today: (p) => now - p.d < D,
    "This week": (p) => now - p.d < 7 * D,
    "This month": (p) => now - p.d < 30 * D,
    Older: (p) => now - p.d >= 30 * D,
  };
  const L = store.posts
    .filter((p) => (p.status ?? "active") === "active" && (p.v !== "me" || p.mine) && !store.hidden.includes(p.id) && (filters.time === "all" || filters.time === "Newest" || tf[filters.time](p)) && (filters.stage === "all" || p.stage === filters.stage))
    .sort((a, b) => b.d - a.d);

  return (
    <div className="in">
      <div className="row"><h1>Community</h1>
        <span>
          <button className="chip" onClick={() => onOpen("filters")}><FilterIcon /> Filters{n ? <span className="bd">{n}</span> : null}</button>{" "}
          <button className="chip on" onClick={() => onOpen("post")}>Share</button>
        </span>
      </div>
      <p className="mu">No betting tips, no shaming.</p>
      {n ? <button className="chip" onClick={() => setFilters({ time: "all", stage: "all" })}>Clear filters</button> : null}
      {L.map((p) => {
        const av = p.av || (p.mine ? store.avatar : null);
        const nm = p.n || store.name;
        return (
        <div className="card pop" key={p.id}>
          <div className="row">
            {p.v === "anon" ? (
              <b>Anonymous {p.s ? <span className="tag">Example</span> : null}</b>
            ) : (
              <button className="prof-link" onClick={() => onOpen("profile", p)}>
                {av
                  ? <img className="c-avatar" src={av} alt="" />
                  : <span className="c-avatar">{(nm || "?").trim().charAt(0).toUpperCase()}</span>}
                <b>{nm}</b>{p.s ? <span className="tag">Example</span> : null}
              </button>
            )}
            <span className="mu">{p.stage}{p.v === "me" ? " · only you" : ""}</span>
          </div>
          <p>{p.t}</p>
          <div className="row"><span className="mu">{new Date(p.d).toLocaleDateString()}</span>
            <span>{p.mine ? <button className="mu" onClick={() => onOpen("del", p)}>Delete</button> : <button className="mu" onClick={() => onOpen("rep", p)}>Report</button>}</span>
          </div>
        </div>
        );
      })}
      {!L.length && <p className="mu">{store.posts.length ? "No posts match these filters." : "No posts yet. Be the first to share your story."}</p>}
    </div>
  );
}
