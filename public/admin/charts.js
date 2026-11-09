// Kleine SVG-Diagramme ohne Bibliothek (Balken gruppiert, Linien). Farben kommen aus CSS-Variablen (hell/dunkel).
const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Wilson-Intervall (95 %) für Anteile k/n
export function wilson(k, n, z = 1.96) {
  if (!n) return null;
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

const niceMax = (v) => {
  if (!(v > 0)) return 1;
  const e = 10 ** Math.floor(Math.log10(v));
  const m = v / e;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e;
};

function frame(w, h, m, yMax, fmt, ticks = 4) {
  let s = '';
  for (let i = 0; i <= ticks; i++) {
    const v = (yMax * i) / ticks, y = m.t + (h - m.t - m.b) * (1 - i / ticks);
    s += `<line class="ch-grid" x1="${m.l}" x2="${w - m.r}" y1="${y}" y2="${y}"/><text class="ch-ax" x="${m.l - 8}" y="${y + 4}" text-anchor="end">${esc(fmt(v))}</text>`;
  }
  return s;
}

function legend(series) {
  return `<div class="ch-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>`;
}

// cats: [{label, sub?}] · series: [{key,label,color}] · values[catIndex][seriesKey] = Zahl | null
// ci[catIndex][seriesKey] = [lo, hi] (optional) · tip[catIndex][seriesKey] = Text (optional)
export function barChart(el, { cats, series, values, ci, tip, fmt = (v) => String(Math.round(v)), yMax, yLabel, aria }) {
  const w = 640, h = 280, m = { l: 48, r: 12, t: 12, b: 52 };
  const all = cats.flatMap((_, i) => series.map((s) => (ci?.[i]?.[s.key]?.[1] ?? values[i][s.key]) ?? 0));
  const top = yMax ?? niceMax(Math.max(...all, 0));
  const iw = w - m.l - m.r, ih = h - m.t - m.b;
  const gw = iw / cats.length, bw = Math.min(46, (gw * 0.78) / series.length);
  let s = frame(w, h, m, top, fmt);
  cats.forEach((c, i) => {
    const x0 = m.l + gw * i + (gw - bw * series.length) / 2;
    series.forEach((se, j) => {
      const v = values[i][se.key];
      const x = x0 + bw * j;
      if (v == null) {
        s += `<text class="ch-na" x="${x + bw / 2}" y="${m.t + ih - 4}" text-anchor="middle">–</text>`;
        return;
      }
      const bh = Math.max(0, (v / top) * ih), y = m.t + ih - bh;
      const t = tip?.[i]?.[se.key] ?? `${se.label}: ${fmt(v)}`;
      s += `<rect class="ch-bar" x="${x + 1}" y="${y}" width="${Math.max(2, bw - 2)}" height="${bh}" rx="4" style="fill:${se.color}"><title>${esc(`${c.label} · ${t}`)}</title></rect>`;
      const e = ci?.[i]?.[se.key];
      if (e) {
        const cx = x + bw / 2, y1 = m.t + ih - (e[0] / top) * ih, y2 = m.t + ih - (e[1] / top) * ih;
        s += `<path class="ch-err" d="M${cx} ${y1}V${y2}M${cx - 4} ${y1}H${cx + 4}M${cx - 4} ${y2}H${cx + 4}"/>`;
      } else if (bw >= 22) {
        s += `<text class="ch-val" x="${x + bw / 2}" y="${y - 4}" text-anchor="middle">${esc(fmt(v))}</text>`;
      }
    });
    s += `<text class="ch-lab" x="${m.l + gw * i + gw / 2}" y="${h - m.b + 18}" text-anchor="middle">${esc(c.label)}</text>`;
    if (c.sub) s += `<text class="ch-sub" x="${m.l + gw * i + gw / 2}" y="${h - m.b + 33}" text-anchor="middle">${esc(c.sub)}</text>`;
  });
  s += `<line class="ch-base" x1="${m.l}" x2="${w - m.r}" y1="${m.t + ih}" y2="${m.t + ih}"/>`;
  if (yLabel) s += `<text class="ch-ax" x="${m.l}" y="9" text-anchor="start">${esc(yLabel)}</text>`;
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria || '')}" preserveAspectRatio="xMidYMid meet">${s}</svg>${legend(series)}`;
}

// Linien: cats auf der x-Achse, je Serie eine Linie (Lücken bei null)
export function lineChart(el, { cats, series, values, tip, fmt = (v) => String(Math.round(v)), yMax, yLabel, aria }) {
  const w = 640, h = 260, m = { l: 48, r: 14, t: 14, b: 36 };
  const all = cats.flatMap((_, i) => series.map((s) => values[i][s.key] ?? 0));
  const top = yMax ?? niceMax(Math.max(...all, 0));
  const iw = w - m.l - m.r, ih = h - m.t - m.b;
  const X = (i) => m.l + (cats.length === 1 ? iw / 2 : (iw * i) / (cats.length - 1));
  const Y = (v) => m.t + ih - (v / top) * ih;
  let s = frame(w, h, m, top, fmt);
  const step = cats.length > 10 ? 2 : 1;
  cats.forEach((c, i) => { if (i % step === 0) s += `<text class="ch-lab" x="${X(i)}" y="${h - m.b + 18}" text-anchor="middle">${esc(c.label)}</text>`; });
  for (const se of series) {
    let d = '', pen = false;
    cats.forEach((_, i) => {
      const v = values[i][se.key];
      if (v == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`;
      pen = true;
    });
    s += `<path class="ch-line" d="${d}" style="stroke:${se.color}"/>`;
    cats.forEach((c, i) => {
      const v = values[i][se.key];
      if (v == null) return;
      s += `<circle class="ch-dot" cx="${X(i)}" cy="${Y(v)}" r="3.6" style="fill:${se.color}"><title>${esc(`${c.label} · ${tip?.[i]?.[se.key] ?? `${se.label}: ${fmt(v)}`}`)}</title></circle>`;
    });
  }
  s += `<line class="ch-base" x1="${m.l}" x2="${w - m.r}" y1="${m.t + ih}" y2="${m.t + ih}"/>`;
  if (yLabel) s += `<text class="ch-ax" x="${m.l}" y="9" text-anchor="start">${esc(yLabel)}</text>`;
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria || '')}">${s}</svg>${legend(series)}`;
}
