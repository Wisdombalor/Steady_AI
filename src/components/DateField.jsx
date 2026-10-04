import { useEffect, useState } from "react";
import { lt } from "../lib/helpers";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

function parseValue(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return { y: "", m: "", d: "" };
  return { y: m[1], m: String(+m[2]), d: String(+m[3]) };
}

export function DateField({ value, onChange, label, max, minYear = 1920 }) {
  const todayStr = lt();
  const maxYear = Number(String(max ?? todayStr).slice(0, 4)) || new Date().getFullYear();
  const [part, setPart] = useState(() => parseValue(value));

  useEffect(() => {
    setPart(parseValue(value));
  }, [value]);

  const years = [];
  for (let yr = maxYear; yr >= minYear; yr--) years.push(String(yr));

  const commit = (ny, nm, nd) => {
    setPart({ y: ny, m: nm, d: nd });
    if (!ny || !nm || !nd) {
      if (!ny && !nm && !nd) onChange("");
      return;
    }
    const dim = daysInMonth(+ny, +nm);
    const dd = Math.min(+nd, dim);
    onChange(`${ny}-${String(nm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`);
  };

  const maxDay = part.y && part.m ? daysInMonth(+part.y, +part.m) : 31;
  const days = [];
  for (let i = 1; i <= maxDay; i++) days.push(String(i));

  return (
    <label>{label}
      <span className="date-grid">
        <select aria-label="Day" value={part.d} onChange={(e) => commit(part.y, part.m, e.target.value)}>
          <option value="">Day</option>
          {days.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select aria-label="Month" value={part.m} onChange={(e) => commit(part.y, e.target.value, part.d)}>
          <option value="">Month</option>
          {MONTHS.map((name, i) => <option key={name} value={String(i + 1)}>{name}</option>)}
        </select>
        <select aria-label="Year" value={part.y} onChange={(e) => commit(e.target.value, part.m, part.d)}>
          <option value="">Year</option>
          {years.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
        </select>
      </span>
    </label>
  );
}
