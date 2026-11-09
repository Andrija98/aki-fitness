// Linijski grafikon težine, običan SVG. Prima bar dva upisa: [{ date: 'YYYY-MM-DD', kg }], od najstarijeg.
// Vrednosti su i u listi "Istorija težine", pa čitač ekrana ne zavisi od grafikona.

import { useState } from 'react';
import { formatNumber, formatShortDate } from '../lib/format.js';

const WIDTH = 300;
const HEIGHT = 110;
const SIDE = 9;
const TOP = 12;
const BASELINE = 104;

const toTime = (date) => new Date(`${date}T12:00:00`).getTime();

export default function WeightChart({ weights }) {
  const [selected, setSelected] = useState(null);

  // X prati pravo vreme: upisi nisu redovni, pa bi jednaki razmaci iskrivili nagib.
  const firstTime = toTime(weights[0].date);
  const timeSpan = toTime(weights.at(-1).date) - firstTime;
  const values = weights.map((w) => w.kg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.15, 0.5);

  const points = weights.map((w) => ({
    ...w,
    x: SIDE + ((toTime(w.date) - firstTime) / timeSpan) * (WIDTH - 2 * SIDE),
    y: TOP + ((max + padding - w.kg) / (max - min + 2 * padding)) * (BASELINE - TOP),
  }));
  const last = points.at(-1);
  const active = selected === null ? null : points[selected];

  function pick(e) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * WIDTH;
    let nearest = 0;
    points.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(points[nearest].x - x)) nearest = i; });
    setSelected(nearest);
  }

  const summary = `Grafikon težine: od ${formatNumber(weights[0].kg)} kg (${formatShortDate(weights[0].date)}) do ${formatNumber(last.kg)} kg (${formatShortDate(last.date)}).`;

  return (
    <div className="col" style={{ gap: 6 }}>
      <div className="weight-chart" onPointerDown={pick} onPointerMove={pick}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setSelected(null); }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} fill="none" role="img" aria-label={summary}>
          <line x1="0" y1={BASELINE} x2={WIDTH} y2={BASELINE} stroke="var(--color-neutral-300)" strokeWidth="2" />
          {active && <line x1={active.x} y1={TOP - 8} x2={active.x} y2={BASELINE} stroke="var(--color-neutral-400)" strokeWidth="2" />}
          <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={(active ?? last).x} cy={(active ?? last).y} r="7" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="3" />
        </svg>
        {active && (
          <span className="chart-tip" style={{ left: `${Math.min(82, Math.max(18, (active.x / WIDTH) * 100))}%` }}>
            {formatNumber(active.kg)} kg · {formatShortDate(active.date)}
          </span>
        )}
      </div>
      <div className="chart-axis"><span>{formatShortDate(weights[0].date)}</span><span>{formatShortDate(last.date)}</span></div>
    </div>
  );
}
