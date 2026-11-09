// Animierte Fortschrittsreise (nur Gamification-Gruppe).
// Forschungsintegrität: Fortschritt UND Punkte hängen ausschließlich von der Zahl beantworteter Fragen ab
// (gleich viele Punkte pro Frage – nie nach Tempo, Antwortinhalt oder Aufmerksamkeit).
// Landschaft = langer Streifen (Wald -> Stadt -> Universität), der pro Frage um STEP verschoben wird,
// während die Figur an fester Stelle läuft. Berge und Hügel bewegen sich langsamer (Parallaxe).
// Meilensteine: nach Q5 Bachelor, nach Q10 Master, nach Q15 Professor (Figur springt und bekommt den Titel).

import { isReduced as reduced } from './prefs.js';

const STEP = 60;       // Pixel pro Frage
const CX = 90;         // feste x-Position der Figur
const PAR_MID = 14;    // Parallaxe Hügel
const PAR_FAR = 7;     // Parallaxe Berge
const GY = 132;        // Bodenlinie
const TOTAL = 15;
const EASINGS = {
  standard: 'cubic-bezier(.45,.05,.3,1)',
  linear: 'linear',
  soft: 'cubic-bezier(.25,.1,.25,1)',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const levelOf = (n) => (n >= 15 ? 3 : n >= 10 ? 2 : n >= 5 ? 1 : 0);

// ---------------------------------------------------------------- Icons
const I = {
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z"/></svg>',
  student: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.7-4 3.6-6 7.5-6s6.8 2 7.5 6"/></svg>',
  cap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5"/><path d="M22 9v6"/></svg>',
  master: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5"/><path d="M22 9v6"/><path d="M12 9.2l.7 1.4 1.5.2-1.1 1 .3 1.5-1.4-.8-1.4.8.3-1.5-1.1-1 1.5-.2z" class="fillme"/></svg>',
  prof: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="9" r="5.5"/><path d="M8.5 14l-1.6 7 5.1-2.6 5.1 2.6-1.6-7"/><path d="M12 6.6l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2L9.1 8.7l2-.3z" class="fillme"/></svg>',
};
const RANK_ICONS = [I.student, I.cap, I.master, I.prof];

// ---------------------------------------------------------------- Szene
const pine = (x, s, d) => `<g transform="translate(${x} ${GY}) scale(${s})"><g class="sway" style="animation-delay:-${d}s">
  <rect class="trunk" x="-2.5" y="-13" width="5" height="13" rx="1.2"/>
  <path class="leaf-b" d="M-15 -10 L0 -38 L15 -10Z"/><path class="leaf-a" d="M-11 -24 L0 -50 L11 -24Z"/></g></g>`;

const oak = (x, s, d) => `<g transform="translate(${x} ${GY}) scale(${s})"><g class="sway" style="animation-delay:-${d}s">
  <rect class="trunk" x="-2.5" y="-16" width="5" height="16" rx="1.2"/>
  <circle class="leaf-b" cx="-6" cy="-22" r="10"/><circle class="leaf-a" cx="3" cy="-29" r="12"/></g></g>`;

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

const milestone = (x, label, n) => `<g class="ms" data-n="${n}" transform="translate(${x} ${GY})">
  <rect class="ms-pole" x="-1" y="-38" width="2" height="38" rx="1"/>
  <g class="ms-flag"><path class="ms-pennant" d="M1 -38 L25 -32 L1 -26Z"/><text class="ms-text" x="10" y="-29.6">${label}</text></g></g>`;

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

function sceneSVG(L) {
  const forest = [[6, 1.05, 'p'], [38, 1.35, 'p'], [72, 0.9, 'o'], [114, 1.2, 'p'], [148, 0.85, 'p'], [184, 1.25, 'o'],
    [222, 1.0, 'p'], [256, 1.3, 'p'], [294, 0.95, 'o'], [330, 1.15, 'p'], [364, 0.8, 'p']];
  const campusTrees = [[708, 0.9], [744, 1.15], [792, 0.95], [840, 1.05], [1124, 1.1], [1166, 0.9], [1210, 1.2], [1256, 0.95], [1298, 1.05]];
  const city = [[398, 40, 70, 'a'], [442, 52, 98, 'b'], [498, 38, 60, 'c'], [540, 46, 86, 'a'], [590, 38, 66, 'b'], [632, 52, 94, 'c']];
  const stars = [[24, 18], [60, 40], [96, 14], [140, 30], [182, 12], [220, 38], [252, 20], [290, 50], [332, 16], [348, 44], [120, 54]];
  const cols = [0, 1, 2, 3, 4, 5].map((i) => `<rect class="uni-col" x="${910 + i * 30}" y="78" width="10" height="45" rx="1.5"/>`).join('');
  const motes = [[40, 70, 1.6, 0], [120, 40, 1.2, 2], [190, 85, 1.8, 4], [250, 55, 1.3, 1], [310, 90, 1.5, 3], [80, 100, 1.1, 5]]
    .map(([x, y, r, d]) => `<circle class="mote" cx="${x}" cy="${y}" r="${r}" style="animation-delay:-${d}s"/>`).join('');

  const back = `
    <rect class="g-forest" x="-60" y="${GY - 4}" width="460" height="40"/>
    <rect class="g-city" x="390" y="${GY - 4}" width="310" height="40"/>
    <rect class="g-uni" x="690" y="${GY - 4}" width="700" height="40"/>
    ${forest.map(([x, s, t], i) => (t === 'p' ? pine : oak)(x, s, (i * 0.7) % 5)).join('')}
    ${city.map(([x, w, h, v], i) => building(x, w, h, v, 17 + i * 31)).join('')}
    ${lamp(474)}${lamp(618)}
    ${campusTrees.map(([x, s], i) => oak(x, s, (i * 0.9) % 5)).join('')}
    <g class="uni">
      <rect class="uni-step" x="884" y="${GY - 3}" width="212" height="5" rx="1"/>
      <rect class="uni-step2" x="892" y="${GY - 8}" width="196" height="5" rx="1"/>
      <rect class="uni-wall" x="900" y="74" width="180" height="50"/>
      ${cols}
      <path class="uni-door" d="M981 124 V108 a9 9 0 0 1 18 0 V124Z"/>
      <rect class="uni-beam" x="894" y="70" width="192" height="6" rx="1"/>
      <path class="uni-roof" d="M888 71 L990 38 L1092 71Z"/>
      <text class="uni-text" x="990" y="63" text-anchor="middle">${L.research}</text>
      <rect class="ms-pole" x="989.2" y="15" width="1.6" height="24"/>
      <path class="uni-flag" d="M991 16 q8 -3 16 0 t16 0 v10 q-8 -3 -16 0 t-16 0Z"/>
    </g>
    <rect class="path" x="-60" y="${GY + 1}" width="1450" height="8" rx="4"/>
    <path class="path-dash" d="M-60 ${GY + 5} H1400"/>
    ${milestone(CX + 5 * STEP + 18, '5', 5)}${milestone(CX + 10 * STEP + 18, '10', 10)}`;

  const front = [16, 130, 210, 300, 720, 820, 1150, 1240].map(tuft).join('');

  // Figur: Fuß auf y=0, Kopf bei y≈-34. Titel-Ebenen (Hut, Robe, Brille, Bart) werden per data-level ein-/ausgeblendet.
  const character = `<g transform="translate(${CX} ${GY + 4}) scale(1.2)"><g class="j-char" data-level="0">
    <circle class="c-ring" cx="0.5" cy="-20" r="11"/>
    <ellipse class="c-shadow" cx="0" cy="0.5" rx="10" ry="2.6"/>
    <g class="c-body">
      <g class="c-limb c-leg-b"><rect class="c-pants-b" x="-2.6" y="-14" width="5.2" height="14" rx="2.6"/></g>
      <g class="c-limb c-arm-b"><rect class="c-skin-b" x="-1.9" y="-27" width="3.8" height="12" rx="1.9"/></g>
      <rect class="c-pack" x="-10" y="-27.5" width="6.5" height="11.5" rx="2.2"/>
      <rect class="c-shirt" x="-5.2" y="-28.5" width="10.4" height="16" rx="4.5"/>
      <g class="c-limb c-leg-f"><rect class="c-pants" x="-2.6" y="-14" width="5.2" height="14" rx="2.6"/></g>
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
    </g></g></g>`;

  return `<svg class="j-svg" viewBox="0 0 360 160" preserveAspectRatio="xMidYMax slice" role="img" focusable="false">
    <defs>
      <linearGradient id="jg-sky" x1="0" y1="0" x2="0" y2="1"><stop class="sk-a" offset="0"/><stop class="sk-b" offset="1"/></linearGradient>
      <radialGradient id="jg-sun"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="jg-vig" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>
    </defs>
    <rect class="sky" x="0" y="0" width="360" height="160" fill="url(#jg-sky)"/>
    <g class="stars">${stars.map(([x, y], i) => `<circle class="star" cx="${x}" cy="${y}" r="${i % 3 ? 0.8 : 1.2}" style="animation-delay:-${i * 0.6}s"/>`).join('')}</g>
    <circle class="sun-glow" cx="306" cy="32" r="34" fill="url(#jg-sun)"/><circle class="sun" cx="306" cy="32" r="12"/>
    <g class="clouds">${cloud(30, 1, 70, 10)}${cloud(52, 0.75, 90, 55)}${cloud(22, 0.6, 110, 80)}</g>
    <g class="j-far2"><path class="mtn" d="${mountains()}"/></g>
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

// ---------------------------------------------------------------- Komponente
export function createJourney(host, L, opts = {}) {
  const WALK_MS = Number(opts.walk_ms) || 1300;
  const EASE = EASINGS[opts.easing] || EASINGS.standard;
  const CONFETTI = opts.confetti !== false;
  const PPA = Number(opts.points_per_answer) || 50;

  const el = document.createElement('div');
  el.className = 'journey';
  el.dataset.world = '0';
  el.innerHTML = `
    <div class="j-scene">${sceneSVG(L)}
      <div class="j-hud">
        <div class="j-pill j-pts-pill"><span class="j-ic gold">${I.star}</span><b class="j-pts">0</b><span class="j-unit">${L.points}</span></div>
        <div class="j-pill j-rank-pill"><span class="j-ic j-rank-ic">${RANK_ICONS[0]}</span><b class="j-rank">${L.ranks[0]}</b></div>
      </div>
      <div class="j-plus" aria-hidden="true">+${PPA}</div>
      <div class="j-ach" role="status" aria-live="polite"><span class="ach-ic">${I.cap}</span><span class="ach-txt"><b></b><small></small></span></div>
      <div class="j-world-tag">${L.worlds[0]}</div>
      <div class="j-confetti" aria-hidden="true"></div>
    </div>
    <div class="j-ladder" aria-hidden="true">
      <div class="lad-line"><i class="lad-fill"></i></div>
      ${L.ranks.map((r, i) => `<div class="lad-node${i === 0 ? ' on' : ''}" data-i="${i}"><span class="lad-dot">${RANK_ICONS[i]}</span><small>${r}</small></div>`).join('')}
    </div>`;
  host.appendChild(el);

  const q = (s) => el.querySelector(s);
  const svg = q('.j-svg');
  const worlds = [...el.querySelectorAll('.j-world')];
  const far = q('.j-far'), far2 = q('.j-far2');
  const char = q('.j-char');
  const fill = q('.lad-fill');
  const ptsEl = q('.j-pts'), ptsPill = q('.j-pts-pill');
  const rankEl = q('.j-rank'), rankIc = q('.j-rank-ic'), rankPill = q('.j-rank-pill');
  const worldTag = q('.j-world-tag');
  const nodes = [...el.querySelectorAll('.lad-node')];
  const flags = [...el.querySelectorAll('.ms')];
  const plus = q('.j-plus');
  const ach = q('.j-ach');
  const confetti = q('.j-confetti');
  const diploma = q('.c-diploma');
  const ring = q('.c-ring');
  let cur = 0, shown = 0, raf = 0, achTimer = 0, dipTimer = 0, lvl = 0;

  function countTo(to, ms) {
    cancelAnimationFrame(raf);
    const from = shown;
    if (!ms || reduced() || from === to) { shown = to; ptsEl.textContent = to; return; }
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      shown = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      ptsEl.textContent = shown;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    ptsPill.classList.remove('bump'); void ptsPill.offsetWidth; ptsPill.classList.add('bump');
  }

  function floatPlus() {
    if (reduced()) return;
    plus.classList.remove('go'); void plus.offsetWidth; plus.classList.add('go');
  }

  function showAch(l) {
    const a = L.ach[l];
    if (!a) return;
    ach.querySelector('.ach-ic').innerHTML = RANK_ICONS[l === 1 ? 1 : l];
    ach.querySelector('b').textContent = a.t;
    ach.querySelector('small').textContent = a.s;
    ach.classList.add('show');
    clearTimeout(achTimer);
    achTimer = setTimeout(() => ach.classList.remove('show'), 3200);
  }

  function burst(n) {
    if (reduced() || !CONFETTI) return;
    const colors = ['#e0682a', '#0b6e8a', '#1f8a5b', '#f2c14e', '#8577b3', '#3fb6d3'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      p.style.setProperty('--x', `${Math.random() * 100}%`);
      p.style.setProperty('--dx', `${(Math.random() - 0.5) * 80}px`);
      p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
      p.style.setProperty('--d', `${Math.random() * 0.35}s`);
      p.style.setProperty('--c', colors[i % colors.length]);
      frag.appendChild(p);
    }
    confetti.appendChild(frag);
    setTimeout(() => { confetti.textContent = ''; }, 2800);
  }

  // Titel/Ebene setzen (Hut, Robe, Brille …) und Rangleiste, Rang-Pille aktualisieren
  function setLevel(l, pulse) {
    lvl = l;
    char.dataset.level = String(l);
    rankEl.textContent = L.ranks[l];
    rankIc.innerHTML = RANK_ICONS[l];
    el.dataset.level = String(l);
    nodes.forEach((nd) => nd.classList.toggle('on', Number(nd.dataset.i) <= l));
    if (pulse) { rankPill.classList.remove('bump'); void rankPill.offsetWidth; rankPill.classList.add('bump'); }
  }

  // Meilenstein: Figur springt, bekommt am höchsten Punkt den Titel, Urkunde + Karte + Konfetti
  async function levelUp(l) {
    const motion = !reduced();
    if (motion) {
      char.classList.remove('jump', 'jump2', 'cheer');
      void char.getBBox();
      char.classList.add(l === 3 ? 'jump2' : 'jump');
      ring.classList.remove('pulse'); void ring.getBBox(); ring.classList.add('pulse');
      await sleep(420);
    }
    setLevel(l, true);
    diploma.classList.add('show');
    clearTimeout(dipTimer);
    dipTimer = setTimeout(() => diploma.classList.remove('show'), 2600);
    showAch(l);
    if (l === 3) { char.classList.add('cheer'); burst(54); } else burst(26);
    const f = flags.find((x) => Number(x.dataset.n) === l * 5);
    if (f) { f.classList.remove('pop'); void f.getBBox(); f.classList.add('pop'); }
    if (motion) {
      await sleep(l === 3 ? 1100 : 700);
      char.classList.remove('jump', 'jump2');
    }
  }

  async function setProgress(n, { animate = false } = {}) {
    n = Math.max(0, Math.min(TOTAL, n));
    const prev = cur;
    cur = n;
    const motion = animate && !reduced() && n !== prev;
    el.classList.toggle('instant', !motion);
    const tr = motion ? `transform ${WALK_MS}ms ${EASE}` : 'none';
    fill.style.transitionDuration = motion ? `${WALK_MS}ms` : '0ms';
    for (const g of worlds) { g.style.transition = tr; g.style.transform = `translateX(${-n * STEP}px)`; }
    far.style.transition = tr; far.style.transform = `translateX(${-n * PAR_MID}px)`;
    far2.style.transition = tr; far2.style.transform = `translateX(${-n * PAR_FAR}px)`;

    const w = n >= 10 ? 2 : n >= 5 ? 1 : 0;
    el.dataset.world = String(w);
    worldTag.textContent = L.worlds[w];
    fill.style.width = `${(n / TOTAL) * 100}%`;
    flags.forEach((f) => f.classList.toggle('reached', n >= Number(f.dataset.n)));
    svg.setAttribute('aria-label', `${L.journeyAria.replace('{n}', n)} · ${n * PPA} ${L.points}`);

    const target = n * PPA;
    const newLvl = levelOf(n);
    if (motion) {
      char.classList.add('walking');
      countTo(target, Math.round(WALK_MS * 0.85));
      floatPlus();
      await sleep(WALK_MS);
      char.classList.remove('walking');
    } else {
      countTo(target, 0);
    }
    if (animate && newLvl > lvl) await levelUp(newLvl);
    else {
      setLevel(newLvl, false);
      if (newLvl === 3 && !animate) char.classList.add('cheer');
      if (newLvl < 3) char.classList.remove('cheer');
    }
  }

  return { el, setProgress, celebrate: () => levelUp(3) };
}
