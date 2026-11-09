// SVG-Szene der Fortschrittsreise. Welt-Streifen (x = Weltkoordinate, Figur steht bei x = CX + Fragen * STEP):
//   Wald (Start) · Stadt mit Universität (x≈390, Bachelor nach Q5) · Kirmes "Libori" (x≈550–830)
//   · Raketenstation (x≈940, Master nach Q10) · antikes griechisches Forum (x≈1240, Professor nach Q15)
// Keine Beschriftungen in der Szene.

export const STEP = 60;   // Pixel pro Frage
const LIBORI_EXTRA = 250; // zusätzlicher Weg zwischen Universität (Q5) und Raketenstation (Q10) für die Kirmes "Libori"
// Weltverschiebung nach n beantworteten Fragen: Q0–5 und Q10–15 je STEP pro Frage, Q5–10 mit Libori-Abschnitt (länger)
export const worldShift = (n) => n * STEP + LIBORI_EXTRA * Math.max(0, Math.min(n, 10) - 5) / 5;
export const CX = 90;     // feste x-Position der Figur im Bild
export const GY = 132;    // Bodenlinie

const pine = (x, s, d) => `<g transform="translate(${x} ${GY}) scale(${s})"><g class="sway" style="animation-delay:-${d}s">
  <rect class="trunk" x="-2.5" y="-13" width="5" height="13" rx="1.2"/>
  <path class="leaf-b" d="M-15 -10 L0 -38 L15 -10Z"/><path class="leaf-a" d="M-11 -24 L0 -50 L11 -24Z"/></g></g>`;

const oak = (x, s, d) => `<g transform="translate(${x} ${GY}) scale(${s})"><g class="sway" style="animation-delay:-${d}s">
  <rect class="trunk" x="-2.5" y="-16" width="5" height="16" rx="1.2"/>
  <circle class="leaf-b" cx="-6" cy="-22" r="10"/><circle class="leaf-a" cx="3" cy="-29" r="12"/></g></g>`;

const olive = (x, s, d) => `<g transform="translate(${x} ${GY}) scale(${s})"><g class="sway" style="animation-delay:-${d}s">
  <path class="trunk" d="M-1.5 0 Q-3 -9 -4 -15 L0 -17 Q1 -9 1.8 0Z"/>
  <ellipse class="ol-b" cx="-6" cy="-21" rx="11" ry="7"/><ellipse class="ol-a" cx="4" cy="-26" rx="12" ry="7.5"/></g></g>`;

const cypress = (x, s, d) => `<g transform="translate(${x} ${GY}) scale(${s})"><g class="sway" style="animation-delay:-${d}s">
  <rect class="trunk" x="-1.4" y="-8" width="2.8" height="8"/><path class="cyp" d="M0 -62 C10 -44 10 -16 0 -6 C-10 -16 -10 -44 0 -62Z"/></g></g>`;

function building(x, w, h, v, seed) {
  const y = GY - h;
  const cols = Math.max(1, Math.floor((w - 8) / 11));
  const rows = Math.max(1, Math.floor((h - 14) / 15));
  const ox = x + (w - (cols * 11 - 5)) / 2;
  let r = seed, wins = '';
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      r = (r * 9301 + 49297) % 233280;
      const lit = r / 233280 > 0.42 ? ' lit' : '';
      wins += `<rect class="win${lit}" x="${(ox + j * 11).toFixed(1)}" y="${y + 9 + i * 15}" width="6" height="8" rx="1"/>`;
    }
  }
  return `<rect class="bld bld-${v}" x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5"/>
    <rect class="bld-cap bld-${v}" x="${x + 4}" y="${y - 4}" width="${w - 8}" height="5" rx="1.5"/>${wins}`;
}

const lamp = (x) => `<g transform="translate(${x} ${GY})"><circle class="lamp-glow" cx="0" cy="-31" r="11"/>
  <rect class="lamp-pole" x="-1" y="-31" width="2" height="31" rx="1"/><circle class="lamp-bulb" cx="0" cy="-32" r="2.8"/></g>`;

const cloud = (y, s, dur, del) => `<g transform="translate(0 ${y}) scale(${s})"><g class="cloud" style="animation-duration:${dur}s;animation-delay:-${del}s">
  <ellipse cx="0" cy="0" rx="17" ry="6"/><ellipse cx="9" cy="-4" rx="10" ry="7"/><ellipse cx="-8" cy="-2.5" rx="8" ry="5"/></g></g>`;

const tuft = (x) => `<path class="tuft" transform="translate(${x} 156)" d="M0 0 L2 -6 L3.2 0 L5 -8 L6.4 0 L8.4 -5 L9.6 0Z"/>`;

function mountains() {
  let r = 7, d = 'M-30 120';
  for (let x = -30; x <= 640; x += 40) {
    r = (r * 9301 + 49297) % 233280;
    d += ` L${x + 20} ${70 + (r / 233280) * 30} L${x + 40} ${104 + (r % 7)}`;
  }
  return `${d} V160 H-30Z`;
}

// ---------------------------------------------------------------- Stadt mit Universität (Bachelor)
function university(cx) {
  const cols = [0, 1, 2, 3, 4, 5].map((i) => `<rect class="uni-col" x="${cx - 80 + i * 30}" y="78" width="10" height="45" rx="1.5"/>`).join('');
  return `<g class="uni">
    <rect class="uni-step" x="${cx - 106}" y="${GY - 3}" width="212" height="5" rx="1"/>
    <rect class="uni-step2" x="${cx - 98}" y="${GY - 8}" width="196" height="5" rx="1"/>
    <rect class="uni-wall" x="${cx - 90}" y="74" width="180" height="50"/>
    ${cols}
    <path class="uni-door" d="M${cx - 9} 124 V108 a9 9 0 0 1 18 0 V124Z"/>
    <rect class="uni-beam" x="${cx - 96}" y="70" width="192" height="6" rx="1"/>
    <path class="uni-roof" d="M${cx - 102} 71 L${cx} 38 L${cx + 102} 71Z"/>
    <circle class="uni-crest" cx="${cx}" cy="58" r="7"/>
    <path class="uni-crest-in" d="M${cx} 53.6 l1.5 3.1 3.4.4-2.5 2.3.7 3.4-3.1-1.7-3.1 1.7.7-3.4-2.5-2.3 3.4-.4z"/>
    <rect class="pole" x="${cx - 0.8}" y="15" width="1.6" height="24"/>
    <path class="uni-flag" d="M${cx + 1} 16 q8 -3 16 0 t16 0 v10 q-8 -3 -16 0 t-16 0Z"/>
  </g>`;
}

// ---------------------------------------------------------------- Raketenstation (Master)
const hangar = (x) => `<g>
  <rect class="hg-wall" x="${x}" y="${GY - 70}" width="72" height="70" rx="2"/>
  <rect class="hg-stripe" x="${x}" y="${GY - 70}" width="72" height="6" rx="2"/>
  <rect class="hg-roof" x="${x - 3}" y="${GY - 75}" width="78" height="6" rx="2"/>
  <rect class="hg-door" x="${x + 18}" y="${GY - 52}" width="36" height="52" rx="2"/>
  <path class="hg-line" d="M${x + 27} ${GY - 52} V${GY} M${x + 36} ${GY - 52} V${GY} M${x + 45} ${GY - 52} V${GY}"/>
  <circle class="hg-logo" cx="${x + 36}" cy="${GY - 62}" r="3.4"/></g>`;

function gantry(x, armLen) {
  const w = 16, h = 104;
  let lat = '';
  for (let i = 0; i < 7; i++) {
    const y = GY - h + i * (h / 7);
    lat += `<path class="tw-x" d="M${x} ${y.toFixed(1)} L${x + w} ${(y + h / 7).toFixed(1)} M${x + w} ${y.toFixed(1)} L${x} ${(y + h / 7).toFixed(1)}"/>`;
  }
  return `<g><rect class="tw-leg" x="${x}" y="${GY - h}" width="2.4" height="${h}"/><rect class="tw-leg" x="${x + w - 2.4}" y="${GY - h}" width="2.4" height="${h}"/>${lat}
    <rect class="tw-arm" x="${x + w}" y="${GY - 76}" width="${armLen}" height="3"/><rect class="tw-arm" x="${x + w}" y="${GY - 46}" width="${armLen}" height="3"/>
    <circle class="blink tw-light" cx="${x + w / 2}" cy="${GY - h - 3}" r="1.9"/></g>`;
}

function rocket(cx) {
  const t = GY - 108, b = GY - 12;
  return `<g class="rocket">
    <path class="rk-fin" d="M${cx - 10} ${GY - 34} L${cx - 20} ${GY - 9} L${cx - 10} ${GY - 15}Z"/><path class="rk-fin" d="M${cx + 10} ${GY - 34} L${cx + 20} ${GY - 9} L${cx + 10} ${GY - 15}Z"/>
    <path class="rk-nose" d="M${cx - 10} ${GY - 84} Q${cx - 10} ${GY - 102} ${cx} ${t} Q${cx + 10} ${GY - 102} ${cx + 10} ${GY - 84}Z"/>
    <rect class="rk-body" x="${cx - 10}" y="${GY - 84}" width="20" height="${b - (GY - 84)}"/>
    <rect class="rk-band" x="${cx - 10}" y="${GY - 52}" width="20" height="6"/>
    <rect class="rk-band" x="${cx - 10}" y="${GY - 30}" width="20" height="3"/>
    <circle class="rk-ring" cx="${cx}" cy="${GY - 68}" r="5"/><circle class="rk-window" cx="${cx}" cy="${GY - 68}" r="3.4"/>
    <path class="rk-shade" d="M${cx + 4} ${GY - 84} H${cx + 10} V${b} H${cx + 4}Z"/>
    <rect class="rk-skirt" x="${cx - 7}" y="${b}" width="14" height="5" rx="1"/>
    <circle class="steam" cx="${cx - 13}" cy="${GY - 7}" r="3" style="animation-delay:0s"/>
    <circle class="steam" cx="${cx + 13}" cy="${GY - 7}" r="3.4" style="animation-delay:-1.1s"/>
    <circle class="steam" cx="${cx + 2}" cy="${GY - 6}" r="2.6" style="animation-delay:-2.2s"/></g>`;
}

const dish = (x) => `<g transform="translate(${x} ${GY - 20})"><rect class="dish-pole" x="-1.5" y="0" width="3" height="20"/>
  <g class="dish"><path class="dish-bowl" d="M-14 -3 Q0 13 14 -3 Q0 5 -14 -3Z"/><path class="dish-arm" d="M0 4 V-9"/><circle class="dish-feed" cx="0" cy="-10" r="2"/></g></g>`;

const tank = (x) => `<g transform="translate(${x} ${GY})"><path class="tank-leg" d="M-7 -5 L-9.5 0 M7 -5 L9.5 0"/>
  <circle class="tank" cx="0" cy="-14" r="11"/><path class="tank-band" d="M-10.8 -14 H10.8"/><circle class="tank-hi" cx="-4" cy="-18" r="3"/></g>`;

const panel = (x) => `<g transform="translate(${x} ${GY})"><rect class="pole" x="-1" y="-14" width="2" height="14"/>
  <path class="panel" d="M-12 -14 L12 -20 L12 -11 L-12 -5Z"/><path class="panel-l" d="M-4 -16 V-7 M4 -18 V-9"/></g>`;

const antenna = (x) => `<g transform="translate(${x} ${GY})"><rect class="pole" x="-1" y="-62" width="2" height="62"/>
  <path class="ant" d="M-7 -50 H7 M-5 -38 H5 M-3 -26 H3"/><circle class="blink tw-light" cx="0" cy="-64" r="2.2"/></g>`;

// ---------------------------------------------------------------- Antikes Forum (Professor): aktives Zentrum des Wissensaustauschs
// Theater mit geschwungenen Sitzstufen (wie das Odeon des Herodes Atticus), aber gepflegt und lebendig:
// Publikum, Redner auf der Bühne, Gesprächsgruppen mit Sprechblasen, Fassade mit beleuchteten Bögen,
// Feuerschalen, Wimpelgirlande, Eulen-Banner (Weisheit) und aufsteigende Ideen-Funken.
const rand = (seed) => { let r = seed; return () => ((r = (r * 9301 + 49297) % 233280) / 233280); };
const quad = (y0, yc, y1, t) => (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * yc + t * t * y1;
const CLO = ['a', 'b', 'c', 'd', 'e', 'f'];

function person(x, y, c, s, d, stand, animated = true) {
  const body = stand
    ? `<rect class="pp pp-${c}" x="-2.3" y="-8.6" width="4.6" height="8.6" rx="1.8"/><circle class="pk pk-${s}" cx="0" cy="-10.8" r="2.2"/>`
    : `<rect class="pp pp-${c}" x="-2" y="-4.4" width="4" height="4.4" rx="1.6"/><circle class="pk pk-${s}" cx="0" cy="-6.3" r="1.9"/>`;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g${animated ? ' class="ppl"' : ''} style="animation-delay:-${d.toFixed(1)}s">${body}</g></g>`;
}

const bubble = (x, y, d) => `<g transform="translate(${x} ${y})"><rect class="sb-b" x="-8" y="-5" width="16" height="9" rx="3"/><path class="sb-b" d="M-3 4 L-5.4 8 L1 4Z"/>
  <circle class="sb-d" cx="-3.6" cy="-0.5" r="1" style="animation-delay:${d}s"/><circle class="sb-d" cx="0" cy="-0.5" r="1" style="animation-delay:${(d + 0.25).toFixed(2)}s"/><circle class="sb-d" cx="3.6" cy="-0.5" r="1" style="animation-delay:${(d + 0.5).toFixed(2)}s"/></g>`;

const brazier = (x) => `<g transform="translate(${x} ${GY - 4})"><circle class="brz-glow" cx="0" cy="-16" r="11"/><rect class="pole" x="-1" y="-12" width="2" height="12"/>
  <path class="brz" d="M-4.4 -12 H4.4 L2.9 -8 H-2.9Z"/><path class="flame-b" d="M0 -23 Q-4.4 -17 -2.7 -12.4 H2.7 Q4.4 -17 0 -23Z"/></g>`;

const banner = (x) => `<g transform="translate(${x} ${GY - 5}) scale(1.2)"><rect class="pole" x="-.8" y="-46" width="1.6" height="46"/><g class="flag-sway"><path class="bn" d="M.8 -45 h15 v23 l-7.5 -5.5 l-7.5 5.5Z"/>
  <text class="bn-t" x="8.3" y="-31.4" text-anchor="middle">UPB</text></g></g>`;

const spark = (x, y, d) => `<g transform="translate(${x} ${y})"><path class="spark" d="M0 -2.4 L.7 -.7 L2.4 0 L.7 .7 L0 2.4 L-.7 .7 L-2.4 0 L-.7 -.7Z" style="animation-delay:-${d}s"/></g>`;

function garland(x1, y1, x2, y2, sag) {
  const xc = (x1 + x2) / 2, yc = (y1 + y2) / 2 + sag * 2;
  const cols = ['#e0463a', '#f2c14e', '#3f86c9', '#ffffff', '#5da35c'];
  let flags = '';
  for (let i = 1; i <= 12; i++) {
    const t = i / 13;
    const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * xc + t * t * x2;
    const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * yc + t * t * y2;
    flags += `<path d="M${(x - 2.7).toFixed(1)} ${y.toFixed(1)} h5.4 l-2.7 5.6Z" fill="${cols[i % 5]}"/>`;
  }
  return `<path class="gar" d="M${x1} ${y1} Q${xc} ${yc} ${x2} ${y2}"/>${flags}`;
}

// Fassade aus hellem Kalkstein mit drei Bogenreihen; einige Bögen sind warm beleuchtet
function facade(x0) {
  const w = 58, h = 86;
  let arches = '', lit = '';
  for (let s = 0; s < 3; s++) {
    for (let k = 0; k < 3; k++) {
      const x = x0 + 5.5 + k * 17.5, y = GY - h + 7 + s * 27;
      arches += `<path class="arch" d="M${x} ${y + 21} V${y + 8} a5.5 5.5 0 0 1 11 0 V${y + 21}Z"/>`;
      if ((s + k) % 2 === 0) lit += `<path class="arch-lit" d="M${x + 1.6} ${y + 21} V${y + 8.5} a3.9 3.9 0 0 1 7.8 0 V${y + 21}Z" style="animation-delay:-${(s * 3 + k) * 0.7}s"/>`;
    }
  }
  return `<g><rect class="lime" x="${x0}" y="${GY - h}" width="${w}" height="${h}" rx="1.5"/>
    <path class="lime-line" d="M${x0} ${GY - h + 29} H${x0 + w} M${x0} ${GY - h + 56} H${x0 + w}"/>${arches}${lit}
    <rect class="lime-cap" x="${x0 - 2.5}" y="${GY - h - 3.5}" width="${w + 5}" height="4.5" rx="1.2"/></g>`;
}

function forum(cx) {
  const ROWS = 7;
  const geo = (i) => ({ h: 52 + i * 10, yEnd: GY - 24 - i * 8.2, yMid: GY - 15 - i * 6.6 });
  const top = geo(ROWS - 1), bot = geo(0);
  const rnd = rand(11);
  let seats = '', crowd = '';
  for (let i = 0; i < ROWS; i++) {
    const g = geo(i), yc = 2 * g.yMid - g.yEnd;
    const d = `M${cx - g.h} ${g.yEnd} Q${cx} ${yc} ${cx + g.h} ${g.yEnd}`;
    seats += `<path class="seat-sh" d="${d}" transform="translate(0 3.4)"/><path class="seat" d="${d}"/>`;
    if (i === 0) continue; // vorderste Reihe bleibt frei
    const n = 5 + i * 2;
    for (let k = 0; k < n; k++) {
      if (rnd() < 0.36) continue;
      const t = (k + 0.5) / n;
      const x = cx - g.h + 2 * g.h * t;
      const y = quad(g.yEnd, yc, g.yEnd, t) - 1.3;
      crowd += person(x, y, CLO[Math.floor(rnd() * 6)], 1 + Math.floor(rnd() * 3), rnd() * 3, false, k % 3 === 0);
    }
  }
  const bowl = `<path class="bowl" d="M${cx - top.h} ${top.yEnd} Q${cx} ${2 * top.yMid - top.yEnd} ${cx + top.h} ${top.yEnd} L${cx + bot.h + 5} ${GY - 6} L${cx - bot.h - 5} ${GY - 6}Z"/>`;
  const ox = cx - 6;
  const orator = `<g transform="translate(${ox} ${GY - 4}) scale(1.25)">
    <rect class="pp pp-w" x="-2.7" y="-9.6" width="5.4" height="9.6" rx="2"/><rect class="toga-band" x="-2.7" y="-6.4" width="5.4" height="1.3"/>
    <circle class="pk pk-1" cx="0" cy="-12" r="2.5"/><path class="laurel" d="M-2.7 -13.6 q2.7 -2.2 5.4 0"/>
    <rect class="scroll-p" x="-5" y="-7" width="2.5" height="3.4" rx="1"/>
    <g class="orator-arm"><rect class="pk pk-1" x="1.5" y="-9.2" width="1.6" height="5.8" rx=".8"/></g></g>`;
  const lectern = `<rect class="mb" x="${cx + 5}" y="${GY - 15}" width="9" height="11" rx="1"/><rect class="mb-cap" x="${cx + 3.5}" y="${GY - 16.6}" width="12" height="2.6" rx="1"/>`;
  const sparks = [[-58, 70, 0], [-30, 56, 1.2], [-4, 64, 2.1], [24, 52, 0.7], [52, 66, 1.7], [76, 58, 2.6]].map(([dx, y, d]) => spark(cx + dx, y, d)).join('');
  const groupA = [[-12, 'b', 1], [-4, 'e', 2], [4, 'c', 3]].map(([dx, c, s], i) => person(944 + dx, GY - 3, c, s, i * 0.9, true)).join('') + bubble(944, GY - 25, 0);
  const groupB = [[0, 'd', 2], [8, 'f', 1]].map(([dx, c, s], i) => person(cx - 38 + dx, GY - 3, c, s, i * 1.1 + 0.4, true)).join('') + bubble(cx - 34, GY - 26, 0.6);

  return `<g class="forum">
    ${facade(cx + 104)}
    ${bowl}${seats}${crowd}
    ${garland(cx - top.h, top.yEnd - 5, cx + 106, GY - 87, 12)}
    <ellipse class="stage" cx="${cx}" cy="${GY - 4}" rx="${bot.h + 10}" ry="7"/><ellipse class="stage-rim" cx="${cx}" cy="${GY - 4}" rx="${bot.h + 10}" ry="7"/>
    ${brazier(cx - 66)}${brazier(cx + 66)}${banner(cx - 78)}
    ${lectern}${orator}${groupA}${groupB}${sparks}
  </g>`;
}

// Rakete im Hintergrund (Effekt am Master-Meilenstein): startet hinter den Hügeln, Rauchspur + Flamme
function launchRocket() {
  const puffs = [[-16, 0], [-7, -1.2], [3, -0.6], [12, -1.8], [19, 0.4]]
    .map(([x, d], i) => `<circle class="fxr-puff" cx="${x}" cy="${GY - 4}" r="${7 + (i % 2) * 3}" style="animation-delay:${(i * 0.12).toFixed(2)}s"/>`).join('');
  return `<g transform="translate(298 124) scale(.5) translate(0 ${-GY})"><g class="fxr">
    <rect class="fxr-trail" x="-5" y="${GY - 8 - 520}" width="10" height="520" rx="5"/>
    ${puffs}
    <g class="fxr-lift">${rocket(0)}
      <path class="fxr-flame" d="M-6.5 ${GY - 7} Q0 ${GY + 26} 6.5 ${GY - 7}Z"/><path class="fxr-flame-in" d="M-3 ${GY - 7} Q0 ${GY + 13} 3 ${GY - 7}Z"/></g>
  </g></g>`;
}

// ---------------------------------------------------------------- Kirmes "Libori": Eingangsbogen, Riesenrad, Buden, Langos-Stand
const awning = (x, y, w, c1, c2) => {
  const n = 6, sw = (w + 6) / n;
  let s = '';
  for (let i = 0; i < n; i++) {
    const x0 = x - 3 + i * sw;
    s += `<path d="M${x0.toFixed(1)} ${y} h${sw.toFixed(1)} v5 q${(-sw / 2).toFixed(1)} 3.4 ${(-sw).toFixed(1)} 0Z" fill="${i % 2 ? c2 : c1}"/>`;
  }
  return s;
};

function booth(x, w, c1, c2, wares, label) {
  return `<g><rect x="${x}" y="${GY - 12}" width="${w}" height="12" fill="#8a5a2f"/><rect x="${x}" y="${GY - 12}" width="${w}" height="2.4" fill="#b07a45"/>
    <rect x="${x + 2}" y="${GY - 31}" width="${w - 4}" height="19.4" fill="#f4e9cf"/>
    <rect x="${x - 1}" y="${GY - 33}" width="2" height="33" fill="#6a4524"/><rect x="${x + w - 1}" y="${GY - 33}" width="2" height="33" fill="#6a4524"/>
    ${awning(x, GY - 33, w, c1, c2)}${wares}
    ${label ? `<rect x="${x + 4}" y="${GY - 29}" width="${w - 8}" height="7" rx="1.5" fill="#3b2a1a"/><text class="lib-sign" x="${x + w / 2}" y="${GY - 23.6}" text-anchor="middle">${label}</text>` : ''}</g>`;
}

const balloon = (x, y, c, d) => `<g class="lib-bal" style="animation-delay:-${d}s"><path d="M${x} ${y + 5} q-1.5 8 1 14" fill="none" stroke="#8a8a8a" stroke-width=".5"/><ellipse cx="${x}" cy="${y}" rx="3.1" ry="3.7" fill="${c}"/><path d="M${x - .6} ${y + 3.7} h1.2l-.6 1.1Z" fill="${c}"/></g>`;

function wheel(cx, cy, r) {
  const spokes = [];
  const gond = [];
  const cols = ['#e0463a', '#f2c14e', '#3f86c9', '#5da35c'];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8, x = Math.cos(a) * r, y = Math.sin(a) * r;
    spokes.push(`<path d="M0 0 L${x.toFixed(1)} ${y.toFixed(1)}" />`);
    gond.push(`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g class="lib-gond"><path d="M0 0 V3" stroke="#555" stroke-width=".7"/><path d="M-3.2 3 h6.4 v4.4 q-3.2 1.6 -6.4 0Z" fill="${cols[i % 4]}"/><rect x="-3.2" y="3" width="6.4" height="1.3" fill="#fff" opacity=".6"/></g></g>`);
  }
  const lights = Array.from({ length: 16 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 16;
    return `<circle class="lib-light" cx="${(Math.cos(a) * r).toFixed(1)}" cy="${(Math.sin(a) * r).toFixed(1)}" r="1.2" style="animation-delay:-${(i * 0.25).toFixed(2)}s"/>`;
  }).join('');
  return `<g transform="translate(${cx} ${cy})">
    <path d="M0 0 L-17 ${GY - cy} M0 0 L17 ${GY - cy}" stroke="#6b7384" stroke-width="2.6" stroke-linecap="round"/><path d="M-13 ${GY - cy - 12} H13" stroke="#6b7384" stroke-width="1.2"/>
    <g class="lib-wheel"><circle r="${r}" fill="none" stroke="#9aa3b4" stroke-width="2"/><circle r="${r * 0.55}" fill="none" stroke="#9aa3b4" stroke-width="1"/>
      <g stroke="#9aa3b4" stroke-width="1" fill="none">${spokes.join('')}</g>${lights}${gond.join('')}</g>
    <circle r="3" fill="#e0463a" stroke="#fff" stroke-width="1"/></g>`;
}

// Karussell: gestreiftes Dach, Lichterkranz, vier Pferdchen die an Stangen auf und ab wippen
function carousel(cx) {
  const horses = [[-16, '#ffffff', 0], [-5.5, '#ffb3c7', 0.5], [5.5, '#fff1a8', 1.0], [16, '#b9e3ff', 1.5]].map(([dx, col, d]) => `<g transform="translate(${cx + dx} ${GY - 8})">
    <path d="M0 -26 V-3" stroke="#e8b93f" stroke-width="1.1"/>
    <g class="lib-horse" style="animation-delay:-${d}s"><ellipse cx="0" cy="-14" rx="4.6" ry="2.7" fill="${col}" stroke="#9aa3b4" stroke-width=".4"/><path d="M3 -15 l2.6 -3.6 l2.4 1.6 l-1.4 3.6Z" fill="${col}" stroke="#9aa3b4" stroke-width=".4"/><circle cx="6.4" cy="-17.4" r=".5" fill="#3b2a1a"/><path d="M-4.6 -14.6 q-2 1.6 -1.4 4" stroke="${col}" stroke-width="1.2" fill="none"/></g></g>`).join('');
  const lights = Array.from({ length: 7 }, (_, k) => `<circle class="lib-light" cx="${cx - 22 + k * 7.3}" cy="${GY - 34.5}" r="1.1" style="animation-delay:-${k * 0.3}s"/>`).join('');
  return `<g class="lib-carousel">
    <ellipse cx="${cx}" cy="${GY - 4}" rx="26" ry="3.4" fill="#7a2a2a"/><rect x="${cx - 26}" y="${GY - 8}" width="52" height="4.4" rx="1.6" fill="#b3262f"/><rect x="${cx - 26}" y="${GY - 8}" width="52" height="1.4" fill="#e8b93f"/>
    <rect x="${cx - 1.6}" y="${GY - 36}" width="3.2" height="30" fill="#e8b93f"/>
    ${horses}
    <path d="M${cx - 28} ${GY - 33} L${cx} ${GY - 48} L${cx + 28} ${GY - 33}Z" fill="#e0463a"/>
    <path d="M${cx - 28} ${GY - 33} L${cx - 14} ${GY - 40.5} L${cx - 7} ${GY - 33}Z M${cx} ${GY - 48} L${cx + 7} ${GY - 33} L${cx + 14} ${GY - 40.5}Z M${cx + 14} ${GY - 40.5} L${cx + 28} ${GY - 33} L${cx + 21} ${GY - 33}Z" fill="#ffffff" opacity=".92"/>
    <rect x="${cx - 29}" y="${GY - 34}" width="58" height="3.2" rx="1.2" fill="#e8b93f"/>${lights}
    <circle cx="${cx}" cy="${GY - 49.5}" r="1.8" fill="#ffe08a"/></g>`;
}

function libori() {
  const x0 = 655; // hoher Eingangsbogen in der Mitte der Kirmes; man sieht das Karussell durch das Tor
  const arch = `<g><rect x="${x0}" y="${GY - 70}" width="3.4" height="70" fill="#7a2a2a"/><rect x="${x0 + 42.6}" y="${GY - 70}" width="3.4" height="70" fill="#7a2a2a"/>
    <path d="M${x0 - 2} ${GY - 70} Q${x0 + 23} ${GY - 82} ${x0 + 48} ${GY - 70}" fill="none" stroke="#e8b93f" stroke-width="2.4"/>
    <rect x="${x0 - 3}" y="${GY - 68}" width="52" height="14" rx="3" fill="#b3262f" stroke="#e8b93f" stroke-width="1.6"/>
    <text class="lib-name" x="${x0 + 23}" y="${GY - 57.4}" text-anchor="middle">Libori</text>
    ${[0, 1, 2, 3, 4, 5].map((k) => `<circle class="lib-light" cx="${x0 + 3 + k * 8.4}" cy="${GY - 68}" r="1.1" style="animation-delay:-${k * 0.3}s"/>`).join('')}</g>`;
  // Langos-Stand links: goldene Teigfladen auf der Theke, Dampf, Verkäufer
  const lx = 592;
  const langos = [0, 1, 2].map((k) => `<ellipse cx="${lx + 7 + k * 8}" cy="${GY - 13.2}" rx="3.6" ry="1.5" fill="#e2a64b"/><ellipse cx="${lx + 7 + k * 8}" cy="${GY - 13.8}" rx="2.4" ry=".9" fill="#f3c872"/>`).join('');
  const steam = [0, 1, 2].map((k) => `<circle class="steam" cx="${lx + 9 + k * 7.5}" cy="${GY - 18}" r="1.9" style="animation-delay:-${k * 0.9}s"/>`).join('');
  // Bier-Bude rechts: Krüge mit Schaum, Fass
  const mugs = [0, 1, 2].map((k) => `<g transform="translate(${800 + k * 7.6} ${GY - 21})"><rect x="0" y="2" width="5" height="7.4" rx="1" fill="#e2a64b" opacity=".95"/><rect x="0" y="0.2" width="5" height="3" rx="1.4" fill="#fffdf2"/><path d="M5 3.6 h1.6 v3.4 h-1.6" fill="none" stroke="#c9d3df" stroke-width=".8"/></g>`).join('');
  const keg = `<g transform="translate(838 ${GY})"><ellipse cx="0" cy="-7.4" rx="5.6" ry="7.4" fill="#8a5a2f"/><path d="M-5.4 -11 H5.4 M-5.6 -4 H5.6" stroke="#c9a66b" stroke-width="1"/><circle cx="0" cy="-7.4" r="1.2" fill="#f2c14e"/></g>`;
  return `<g class="libori">
    ${carousel(679)}
    ${booth(lx, 36, '#f2c14e', '#ffffff', langos + steam, 'Langos')}
    ${person(lx + 24, GY - 12, 'e', 2, 0.5, true)}
    ${person(lx - 6, GY - 2, 'c', 2, 0.3, true)}${person(lx - 15, GY - 2, 'a', 1, 1.6, true)}
    ${arch}
    ${wheel(752, GY - 44, 32)}
    ${booth(794, 34, '#7a4a1f', '#f2c14e', mugs, 'Bier')}
    ${person(819, GY - 12, 'd', 1, 1.1, true)}${keg}
    ${person(786, GY - 2, 'b', 1, 1.4, true)}${person(776, GY - 2, 'f', 3, 0.8, true)}
    ${garland(lx + 38, GY - 36, x0, GY - 69, 5)}${garland(x0 + 46, GY - 69, 752, GY - 80, 4)}${garland(752, GY - 80, 811, GY - 36, 7)}
  </g>`;
}

// Cybertruck-artiger Pickup (Edelstahl-Look, kantig, ohne Logo) seitlich an der vorderen Rakete festgeschnallt:
// steht hochkant (Nase nach oben, Räder zur Rakete) und ist mit zwei Seilen an der Rakete festgebunden
function tesla(cx) {
  const y0 = GY - 52; // Mitte des Pickups an der Rakete
  return `<g class="tesla">
    <g transform="matrix(0 -1.45 -1.45 0 ${cx + 12.4} ${y0})"><g class="tesla-car">
      <path d="M-15 -3 V-9 H-8 L-6.5 -11.4 H-1.5 L15 -5.8 V-3Z" fill="#c4cad4"/>
      <path d="M-15 -3 V-5 H15 V-3Z" fill="#8f97a5"/>
      <path d="M11.4 -6.2 L-0.6 -10.4 H-5.6 V-6.6Z" fill="#17212d"/>
      <path d="M-5.6 -6.6 V-10.4" stroke="#8f97a5" stroke-width=".5"/>
      <path d="M15 -5.8 V-3.6" stroke="#fff7c2" stroke-width="1.4"/><path d="M-15 -8 V-5.4" stroke="#e0463a" stroke-width="1.2"/>
      <path d="M-11.6 -3 a3.6 3.6 0 0 1 7.2 0Z M5.2 -3 a3.6 3.6 0 0 1 7.2 0Z" fill="#2a303a"/>
      <circle cx="-8" cy="-1.6" r="3.1" fill="#16181d"/><circle cx="-8" cy="-1.6" r="1.2" fill="#aeb6c4"/>
      <circle cx="8.8" cy="-1.6" r="3.1" fill="#16181d"/><circle cx="8.8" cy="-1.6" r="1.2" fill="#aeb6c4"/>
    </g></g>
    <path class="rope" d="M${cx - 10.5} ${y0 - 14} Q${cx + 9} ${y0 - 18} ${cx + 29} ${y0 - 14}"/>
    <path class="rope" d="M${cx - 10.5} ${y0 + 14} Q${cx + 9} ${y0 + 18} ${cx + 29} ${y0 + 14}"/>
  </g>`;
}

// Felsiger Gipfel mit Schneefeldern, zwei Spitzen (wie der Jubiläumsgrat der Zugspitze) und kleinem goldenem Gipfelkreuz
function summit() {
  const cx = 196; // Weltkoordinate des Hauptgipfels
  return `<g class="summit">
    <path class="mtn" d="M${cx - 92} 126 L${cx - 62} 88 L${cx - 50} 94 L${cx - 30} 62 L${cx - 18} 70 L${cx} 36 L${cx + 10} 50 L${cx + 24} 44 L${cx + 54} 90 L${cx + 66} 98 L${cx + 94} 126Z"/>
    <path d="M${cx} 36 L${cx + 10} 50 L${cx + 24} 44 L${cx + 54} 90 L${cx + 66} 98 L${cx + 94} 126 L${cx + 20} 126 L${cx + 8} 84 L${cx - 2} 66Z" fill="#1c2340" opacity=".2"/>
    <path d="M${cx} 36 L${cx - 10} 53 L${cx - 3} 51 L${cx + 2} 59 L${cx + 7} 50 L${cx + 10} 50Z" fill="#f4f7fb"/>
    <path d="M${cx + 24} 44 L${cx + 16} 58 L${cx + 22} 56 L${cx + 27} 63 L${cx + 31} 54 L${cx + 36} 58Z" fill="#f4f7fb"/>
    <path d="M${cx - 30} 62 L${cx - 38} 76 L${cx - 32} 73 L${cx - 27} 79 L${cx - 22} 70 L${cx - 18} 70Z" fill="#f4f7fb" opacity=".9"/>
    <path d="M${cx - 8} 70 L${cx - 14} 92 M${cx + 12} 74 L${cx + 20} 100" stroke="#f4f7fb" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>
    <circle class="summit-glow" cx="${cx}" cy="29.5" r="4.6" fill="#ffd34d"/>
    <g class="summit-cross"><rect x="${cx - 0.8}" y="24" width="1.6" height="12.6" fill="#f2b705"/><rect x="${cx - 3.6}" y="27.2" width="7.2" height="1.6" fill="#f2b705"/></g>
  </g>`;
}

// ---------------------------------------------------------------- Szene
export function sceneSVG() {
  const forest = [[6, 1.05, 'p'], [38, 1.35, 'p'], [72, 0.9, 'o'], [114, 1.2, 'p'], [148, 0.85, 'p'], [184, 1.25, 'o'],
    [222, 1.0, 'p'], [256, 1.3, 'p'], [294, 0.95, 'o'], [318, 0.8, 'p']];
  const city = [[262, 38, 66, 'a'], [300, 34, 52, 'b']];
  const stars = [[24, 18], [60, 40], [96, 14], [140, 30], [182, 12], [220, 38], [252, 20], [290, 50], [332, 16], [348, 44], [120, 54]];
  const motes = [[40, 70, 1.6, 0], [120, 40, 1.2, 2], [190, 85, 1.8, 4], [250, 55, 1.3, 1], [310, 90, 1.5, 3], [80, 100, 1.1, 5]]
    .map(([x, y, r, d]) => `<circle class="mote" cx="${x}" cy="${y}" r="${r}" style="animation-delay:-${d}s"/>`).join('');

  const back = `
    <rect class="g-forest" x="-60" y="${GY - 4}" width="400" height="40"/>
    <rect class="g-city" x="330" y="${GY - 4}" width="540" height="40"/>
    <rect class="g-space" x="870" y="${GY - 4}" width="290" height="40"/>
    <rect class="g-greek" x="1150" y="${GY - 4}" width="700" height="40"/>

    ${forest.map(([x, s, t], i) => (t === 'p' ? pine : oak)(x, s, (i * 0.7) % 5)).join('')}

    ${city.map(([x, w, h, v], i) => building(x, w, h, v, 17 + i * 31)).join('')}
    ${university(430)}
    ${lamp(334)}${lamp(542)}${libori()}${lamp(846)}

    <g transform="translate(250 0)">
    ${hangar(646)}
    ${gantry(722, 18)}${rocket(766)}${tesla(766)}
    <rect class="pad" x="708" y="${GY - 4}" width="108" height="5" rx="1.5"/>
    ${tank(826)}${tank(848)}${dish(872)}${panel(894)}${antenna(916)}

    ${forum(1100)}
    ${cypress(922, 1, 0.4)}${olive(1290, 1.05, 2)}
    </g>

    <rect class="path" x="-60" y="${GY + 1}" width="1860" height="8" rx="4"/>
    <path class="path-dash" d="M-60 ${GY + 5} H1800"/>`;

  const front = [16, 130, 210, 300].map(tuft).join('');

  // Figur: Fuß auf y=0, Kopf bei y≈-34. Titel-Ebenen (Hut, Robe, Brille, Bart) per data-level.
  // Fahrzeuge: Level 1 (nach Bachelor) = Fahrrad, Level 2+3 (ab Master) = Cabrio.
  const wheel = (x, y, r) => `<g transform="translate(${x} ${y})"><g class="wspin"><circle class="tire" r="${r}"/><circle class="rim" r="${r - 2}"/><path class="spoke" d="M${-(r - 2)} 0H${r - 2}M0 ${-(r - 2)}V${r - 2}M${-(r - 2) * 0.7} ${-(r - 2) * 0.7}L${(r - 2) * 0.7} ${(r - 2) * 0.7}M${-(r - 2) * 0.7} ${(r - 2) * 0.7}L${(r - 2) * 0.7} ${-(r - 2) * 0.7}"/><circle class="hub" r="1.1"/></g></g>`;
  const bike = `<g class="veh veh-bike">
      ${wheel(-12, -9, 8.6)}${wheel(12, -9, 8.6)}
      <path class="frame" d="M-12 -9 L-2 -8 L-4 -21 L7 -21 L12 -9 M-2 -8 L7 -21 M-4 -21 L-12 -9 M7 -21 L8 -25 M7.4 -25.2 H11.4"/>
      <rect class="saddle" x="-7.6" y="-23.8" width="7.4" height="2.5" rx="1.2"/>
      <g transform="translate(-2 -8)"><g class="cspin"><path class="frame" d="M0 -4 V4"/><rect class="pedal" x="-2.2" y="-5.2" width="4.4" height="1.5" rx=".6"/><rect class="pedal" x="-2.2" y="3.7" width="4.4" height="1.5" rx=".6"/></g></g>
    </g>`;
  const carBack = `<g class="veh veh-car">
      <rect class="car-seat" x="-15" y="-25.5" width="6.5" height="11" rx="2.6"/>
      <path class="car-seat" d="M-9 -15 H3 V-12 H-9Z"/>
      <path class="steer" d="M3.4 -18 L5.6 -22.6"/><ellipse class="steer-w" cx="5.7" cy="-22.8" rx="1.1" ry="2.6" transform="rotate(28 5.7 -22.8)"/>
    </g>`;
  const carFront = `<g class="veh veh-car-front">
      <path class="car-body" d="M-25 -8 Q-26.2 -13 -23 -15 L-12 -16.5 L2 -17.4 L7 -17.8 L10.5 -17.2 L21 -15.4 Q26.6 -14 26.8 -9.5 L25.5 -5.4 H-22 Q-25 -5.4 -25 -8Z"/>
      <path class="car-strip" d="M-23.5 -11.2 H25.4"/>
      <path class="car-glass" d="M2.2 -17.4 L6.2 -25 L8 -24.6 L5.8 -17.6Z"/><path class="car-bar" d="M2.2 -17.4 L6.2 -25"/>
      <circle class="well" cx="-14" cy="-6.5" r="7.8"/><circle class="well" cx="14" cy="-6.5" r="7.8"/>
      ${wheel(-14, -6.5, 6.4)}${wheel(14, -6.5, 6.4)}
      <circle class="head-l" cx="25.4" cy="-12.2" r="1.9"/><rect class="tail-l" x="-25.8" y="-13.6" width="2.2" height="3.4" rx="1"/>
      <circle class="puff" cx="-27" cy="-6" r="2" style="animation-delay:0s"/><circle class="puff" cx="-27" cy="-6" r="2" style="animation-delay:-.45s"/>
    </g>`;
  const character = `<g transform="translate(${CX} ${GY + 4}) scale(1.2)"><g class="j-char" data-level="0">
    <circle class="c-ring" cx="0.5" cy="-20" r="11"/>
    <ellipse class="c-shadow" cx="0" cy="0.5" rx="10" ry="2.6"/>
    <g class="c-all">
    ${bike}${carBack}
    <g class="c-pose"><g class="c-body">
      <g class="c-limb c-leg-b"><rect class="c-pants-b" x="-2.6" y="-14" width="5.2" height="14" rx="2.6"/></g>
      <g class="c-limb bk-leg bk-leg-b"><rect class="c-pants-b" x="-2.4" y="-14" width="4.8" height="14.5" rx="2.4"/></g>
      <g class="c-limb c-arm-b"><rect class="c-skin-b" x="-1.9" y="-27" width="3.8" height="12" rx="1.9"/></g>
      <rect class="c-pack" x="-10" y="-27.5" width="6.5" height="11.5" rx="2.2"/>
      <rect class="c-shirt" x="-5.2" y="-28.5" width="10.4" height="16" rx="4.5"/>
      <g class="c-limb c-leg-f"><rect class="c-pants" x="-2.6" y="-14" width="5.2" height="14" rx="2.6"/></g>
      <g class="c-limb bk-leg bk-leg-a"><rect class="c-pants" x="-2.4" y="-14" width="4.8" height="14.5" rx="2.4"/></g>
      <g class="c-gown"><path class="c-robe" d="M-6.4 -28.6 Q-8 -15 -7.4 -7.5 L7.6 -7.5 Q8 -15 6.4 -28.6Z"/><path class="c-stole" d="M-2.4 -28.8 L-0.6 -8 L2.6 -8 L2.8 -28.8Z"/></g>
      <circle class="c-skin" cx="0.5" cy="-34.5" r="6"/>
      <path class="c-hair" d="M-5.6 -34.6 A6.1 6.1 0 0 1 6.5 -35.6 Q3 -38.4 -0.6 -36.4 Q-3 -35 -5.6 -34.6Z"/>
      <circle class="c-eye" cx="3.4" cy="-34.6" r="0.85"/>
      <path class="c-beard" d="M-3.4 -31.4 Q0.5 -25.8 5.4 -31.4 Q3.4 -29.8 0.8 -29.8 Q-1.6 -29.8 -3.4 -31.4Z"/>
      <g class="c-glasses"><circle cx="3.6" cy="-34.8" r="2.4"/><path d="M1.2 -34.8 H-1.4"/></g>
      <g class="c-cap"><path class="c-cap-base" d="M-4.8 -40 V-36.6 Q0.6 -34 6 -36.6 V-40Z"/>
        <path class="c-cap-board" d="M-10 -40.6 L0.6 -45.6 L11.2 -40.6 L0.6 -36.4Z"/>
        <path class="c-tassel" d="M10.4 -40.4 V-34"/><circle class="c-tassel-b" cx="10.4" cy="-33.2" r="1.4"/></g>
      <g class="c-limb c-arm-f"><rect class="c-skin" x="-1.9" y="-27" width="3.8" height="12" rx="1.9"/></g>
      <g class="c-diploma" transform="translate(5.5 -18) rotate(-28)"><rect class="dip-paper" x="-5.4" y="-1.8" width="10.8" height="3.6" rx="1.8"/><rect class="dip-ribbon" x="-0.9" y="-2" width="1.8" height="4"/></g>
    </g></g>
    ${carFront}
    </g></g></g>`;

  return `<svg class="j-svg" viewBox="0 0 360 160" preserveAspectRatio="xMidYMax slice" role="img" focusable="false">
    <defs>
      <linearGradient id="jg-sky" x1="0" y1="0" x2="0" y2="1"><stop class="sk-a" offset="0"/><stop class="sk-b" offset="1"/></linearGradient>
      <radialGradient id="jg-sun"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <clipPath id="jg-cabclip"><rect x="-60" y="-140" width="120" height="126.5"/></clipPath>
      <linearGradient id="jg-vig" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>
    </defs>
    <rect class="sky" x="0" y="0" width="360" height="160" fill="url(#jg-sky)"/>
    <g class="stars">${stars.map(([x, y], i) => `<circle class="star" cx="${x}" cy="${y}" r="${i % 3 ? 0.8 : 1.2}" style="animation-delay:-${i * 0.6}s"/>`).join('')}</g>
    <g class="planet"><circle class="planet-body" cx="262" cy="46" r="13"/><ellipse class="planet-ring" cx="262" cy="46" rx="22" ry="5" transform="rotate(-16 262 46)"/></g>
    <g class="sunset"><circle class="sun-glow" cx="306" cy="32" r="34" fill="url(#jg-sun)"/><circle class="sun" cx="306" cy="32" r="12"/></g>
    <g class="clouds">${cloud(30, 1, 70, 10)}${cloud(52, 0.75, 90, 55)}${cloud(22, 0.6, 110, 80)}</g>
    <g class="fx-fire"></g>
    <g class="j-far2"><path class="mtn" d="${mountains()}"/>${summit()}</g>
    ${launchRocket()}
    <g class="j-far">
      <path class="hill-2" d="M-20 110 C40 82 110 90 180 102 S300 78 380 96 S520 84 600 98 S720 80 800 94 V160 H-20Z"/>
      <path class="hill-1" d="M-20 120 C70 102 150 110 220 116 S360 98 440 112 S600 102 680 114 S760 106 800 112 V160 H-20Z"/>
    </g>
    <g class="j-world">${back}</g>
    ${character}
    <g class="j-world">${front}</g>
    <g class="motes">${motes}</g>
    <rect x="0" y="0" width="360" height="160" fill="url(#jg-vig)" pointer-events="none"/>
  </svg>`;
}
// Stand: Libori mit Tor-Karussell (Version 3)
