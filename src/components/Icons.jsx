export function Icon({ d, extra }) {
  if (extra) return <span dangerouslySetInnerHTML={{ __html: extra }} />;
  return (
    <svg className="ic" viewBox="0 0 24 24">
      <path d={d} />
    </svg>
  );
}

const paths = {
  filter: "M4 6h16M7 12h10M10 18h4",
  home: "M3 11l9-8 9 8M5 10v10h14V10",
  rec: "M3 17l6-6 4 4 8-8M15 7h6v6",
  sup: "M12 21s-8-5-8-11a4.5 4.5 0 018-3 4.5 4.5 0 018 3c0 6-8 11-8 11z",
  back: "M15 5l-7 7 7 7",
};

export function TabIcon({ tab }) {
  if (tab === "com") {
    return (
      <svg className="ic" viewBox="0 0 24 24">
        <circle cx={9} cy={8} r={3.5} />
        <path d="M2 20c0-4 3-6 7-6s7 2 7 6M17 5a3.5 3.5 0 010 7M22 20c0-3-2-5-4-5.5" />
      </svg>
    );
  }
  if (tab === "pro") {
    return (
      <svg className="ic" viewBox="0 0 24 24">
        <circle cx={12} cy={8} r={4} />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </svg>
    );
  }
  return <Icon d={paths[tab]} />;
}

export function FilterIcon() {
  return (
    <svg className="ic" viewBox="0 0 24 24">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg className="ic" viewBox="0 0 24 24">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden>
      <rect x={3} y={5} width={18} height={16} rx={2} />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export const GoogleIcon = (
  <svg width={18} height={18} viewBox="0 0 48 48" style={{ verticalAlign: -3, marginRight: 8 }} aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

export const MailIcon = (
  <svg className="ic" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
    <rect x={3} y={5} width={18} height={14} rx={2} />
    <path d="M3 7l9 6 9-6" />
  </svg>
);
