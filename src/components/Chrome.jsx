import { useId, useLayoutEffect, useRef, useState } from "react";
import { TabIcon, EyeIcon, EyeOffIcon } from "./Icons";

const TABS = [["home","Home"],["rec","Recovery"],["com","Community"],["sup","Support"],["pro","Profile"]];

export function Nav({ tab, onTab, me, onProfile, onLogin, onSignup }) {
  return (
    <nav aria-label="Main">
      <div className="nav-brand" aria-label="Steady">Steady<span>A little steadier, every day.</span></div>
      {TABS.map(([v, label]) => (
        <button key={v} className={tab === v ? "on" : ""} aria-current={tab === v ? "page" : undefined} onClick={() => onTab(v)}>
          <i aria-hidden="true"><TabIcon tab={v} /></i>{label}
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

// Native modal dialogs contain keyboard focus, make the background inert,
// and restore focus to the trigger when dismissed.
function useModalDialog(open, children) {
  const ref = useRef(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement;
    const containFocus = (e) => {
      if (e.key !== "Tab") return;
      const controls = [...dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
        .filter((el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    dialog.addEventListener("keydown", containFocus);
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.removeEventListener("keydown", containFocus);
      if (dialog.open) dialog.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  useLayoutEffect(() => {
    const dialog = ref.current;
    const heading = dialog?.querySelector("h1, h2");
    if (heading) {
      heading.id = titleId;
      dialog.setAttribute("aria-labelledby", titleId);
    } else dialog?.removeAttribute("aria-labelledby");
    if (dialog?.open && !dialog.contains(document.activeElement)) dialog.querySelector("button")?.focus();
  }, [children, titleId]);
  return ref;
}

export function Sheet({ open, onClose, children }) {
  const ref = useModalDialog(open, children);

  if (!open) return null;
  return (
    <dialog ref={ref} id="sheet" aria-label="Steady panel" aria-modal="true"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
      }}>
      <div className="sheet-tools"><button type="button" className="sheet-close" onClick={onClose} aria-label="Close panel">Close <span aria-hidden="true">×</span></button></div>
      <div className="in">{children}</div>
    </dialog>
  );
}

export function Modal({ data, onClose }) {
  const ref = useModalDialog(!!data, data);
  if (!data) return null;
  return (
    <dialog ref={ref} id="modal" className="on" aria-label="Welcome to Steady" aria-modal="true" onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <svg className="ck" viewBox="0 0 80 80"><circle cx={40} cy={40} r={32} /><path d="M26 41l10 10 19-21" /></svg>
        <h2 className="st" style={{ animationDelay: "500ms" }}>You&apos;re here, {data.name}.</h2>
        <p className="st" style={{ animationDelay: "620ms" }}>{data.quote}</p>
        <button className="btn st" style={{ animationDelay: "740ms" }} onClick={onClose}>Let&apos;s go</button>
      </div>
    </dialog>
  );
}

export function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw-wrap">
      <input {...props} aria-label={props["aria-label"] || "Password"} type={show ? "text" : "password"} />
      <button
        type="button"
        className="pw-toggle"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow(!show)}
        aria-pressed={show}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </span>
  );
}

export function Chips({ options, value, onPick }) {
  return (
    <div className="chips">
      {options.map((x) => (
        <button type="button" key={x} className={"chip " + (value === x ? "on" : "")} aria-pressed={value === x} onClick={() => onPick(x)}>{x}</button>
      ))}
    </div>
  );
}
