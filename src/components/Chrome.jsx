import { useEffect } from "react";
import { TabIcon } from "./Icons";

const TABS = [["home","Home"],["rec","Recovery"],["com","Community"],["sup","Support"],["pro","Profile"]];

export function Nav({ tab, onTab, me, onProfile, onLogin, onSignup }) {
  return (
    <nav aria-label="Main">
      {TABS.map(([v, label]) => (
        <button key={v} className={tab === v ? "on" : ""} onClick={() => onTab(v)}>
          <i><TabIcon tab={v} /></i>{label}
        </button>
      ))}
      <div className="nav-foot">
        {me?.loggedIn ? (
          <button className="nav-profile" onClick={onProfile} aria-label="View profile">
            {me.avatar
              ? <img className="avatar" src={me.avatar} alt="" />
              : <span className="avatar">{(me.name || "?").trim().charAt(0).toUpperCase()}</span>}
            <span className="nav-id"><b>{me.name || "You"}</b><small>{me.email || "View profile"}</small></span>
          </button>
        ) : (
          <div className="nav-auth">
            <button className="btn" onClick={onLogin}>Log in</button>
            <button className="btn sec" onClick={onSignup}>Sign up</button>
          </div>
        )}
      </div>
    </nav>
  );
}

export function Sheet({ open, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.classList.toggle("open", open);
  }, [open ]);

  if (!open) return null;
  return (
    <>
      <div id="scrim" style={{ opacity: 1, pointerEvents: "auto" }} onClick={onClose} />
      <div id="sheet" role="dialog" aria-modal="true" style={{ transform: "none", visibility: "visible" }}>
        <div className="in">{children}</div>
      </div>
    </>
  );
}

export function Modal({ data, onClose }) {
  if (!data) return null;
  return (
    <div id="modal" className="on" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <svg className="ck" viewBox="0 0 80 80"><circle cx={40} cy={40} r={32} /><path d="M26 41l10 10 19-21" /></svg>
        <h2 className="st" style={{ animationDelay: "500ms" }}>You&apos;re here, {data.name}.</h2>
        <p className="st" style={{ animationDelay: "620ms" }}>{data.quote}</p>
        <button className="btn st" style={{ animationDelay: "740ms" }} onClick={onClose}>Let&apos;s go</button>
      </div>
    </div>
  );
}

export function Chips({ options, value, onPick }) {
  return (
    <div className="chips">
      {options.map((x) => (
        <button key={x} className={"chip " + (value === x ? "on" : "")} onClick={() => onPick(x)}>{x}</button>
      ))}
    </div>
  );
}
