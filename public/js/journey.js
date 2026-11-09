// Animierte Fortschrittsreise (nur Gamification-Gruppe).
// Fortschritt hängt ausschließlich von der Zahl abgeschlossener Fragen ab.
// Die Landschaft ist ein langer Streifen (Wald -> Stadt -> Universität), der pro Frage um STEP verschoben wird,
// während die Figur an fester Stelle läuft. Ferne Hügel bewegen sich langsamer (Parallaxe).

const STEP = 60;      // Pixel pro Frage
const CX = 90;        // feste x-Position der Figur
const PAR = 14;       // Parallaxe der Hügel
const GY = 132;       // Bodenlinie
const TOTAL = 15;
const EASINGS = {
  standard: 'cubic-bezier(.45,.05,.3,1)',
  linear: 'linear',
  soft: 'cubic-bezier(.25,.1,.25,1)',
};

import { isReduced as reduced } from './prefs.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  return `<rect class="bld bld-${v}" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>
    <rect class="bld-cap bld-${v}" x="${x + 4}" y="${y - 4}" width="${w - 8}" height="5" rx="1"/>${wins}`;
}

const lamp = (x) => `<g transform="translate(${x} ${GY})"><circle class="lamp-glow" cx="0" cy="-31" r="10"/>
  <rect class="lamp-pole" x="-1" y="-31" width="2" height="31" rx="1"/><circle class="lamp-bulb" cx="0" cy="-32" r="2.8"/></g>`;

const milestone = (x, label, n) => `<g class="ms" data-n="${n}" transform="translate(${x} ${GY})">
  <rect class="ms-pole" x="-1" y="-38" width="2" height="38" rx="1"/>
  <g class="ms-flag"><path class="ms-pennant" d="M1 -38 L25 -32 L1 -26Z"/><text class="ms-text" x="10" y="-29.6">${label}</text></g></g>`;

const cloud = (y, s, dur, del) => `<g transform="translate(0 ${y}) scale(${s})"><g class="cloud" style="animation-duration:${dur}s;animation-delay:-${del}s">
  <ellipse cx="0" cy="0" rx="17" ry="6"/><ellipse cx="9" cy="-4" rx="10" ry="7"/><ellipse cx="-8" cy="-2.5" rx="8" ry="5"/></g></g>`;

const tuft = (x) => `<path class="tuft" transform="translate(${x} 156)" d="M0 0 L2 -6 L3.2 0 L5 -8 L6.4 0 L8.4 -5 L9.6 0Z"/>`;

function sceneSVG(L) {
  const forest = [[6, 1.05, 'p'], [38, 1.35, 'p'], [72, 0.9, 'o'], [114, 1.2, 'p'], [148, 0.85, 'p'], [184, 1.25, 'o'],
    [222, 1.0, 'p'], [256, 1.3, 'p'], [294, 0.95, 'o'], [330, 1.15, 'p'], [364, 0.8, 'p']];
  const campusTrees = [[708, 0.9], [744, 1.15], [792, 0.95], [840, 1.05], [1124, 1.1], [1166, 0.9], [1210, 1.2], [1256, 0.95], [1298, 1.05]];
  const city = [[398, 40, 70, 'a'], [442, 52, 98, 'b'], [498, 38, 60, 'c'], [540, 46, 86, 'a'], [590, 38, 66, 'b'], [632, 52, 94, 'c']];
  const stars = [[24, 18], [60, 40], [96, 14], [140, 30], [182, 12], [220, 38], [252, 20], [290, 50], [332, 16], [348, 44], [120, 54]];
  const cols = [0, 1, 2, 3, 4, 5].map((i) => `<rect class="uni-col" x="${910 + i * 30}" y="78" width="10" height="45" rx="1.5"/>`).join('');

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
    <rect class="path" x="-60" y="${GY + 1}" width="1450" height="7" rx="3.5"/>
    ${milestone(CX + 5 * STEP + 18, '5', 5)}${milestone(CX + 10 * STEP + 18, '10', 10)}`;

  const front = [16, 130, 210, 300, 720, 820, 1150, 1240].map(tuft).join('');

  const character = `<g transform="translate(${CX} ${GY + 4})"><g class="j-char">
    <ellipse class="c-shadow" cx="0" cy="0.5" rx="10" ry="2.6"/>
    <g class="c-body">
      <g class="c-limb c-leg-b"><rect class="c-pants-b" x="-2.6" y="-14" width="5.2" height="14" rx="2.6"/></g>
      <g class="c-limb c-arm-b"><rect class="c-skin-b" x="-1.9" y="-27" width="3.8" height="12" rx="1.9"/></g>
      <rect class="c-pack" x="-10" y="-27.5" width="6.5" height="11.5" rx="2.2"/>
      <rect class="c-shirt" x="-5.2" y="-28.5" width="10.4" height="16" rx="4.5"/>
      <g class="c-limb c-leg-f"><rect class="c-pants" x="-2.6" y="-14" width="5.2" height="14" rx="2.6"/></g>
      <circle class="c-skin" cx="0.5" cy="-34.5" r="6"/>
      <path class="c-hair" d="M-5.6 -34.6 A6.1 6.1 0 0 1 6.5 -35.6 Q3 -38.4 -0.6 -36.4 Q-3 -35 -5.6 -34.6Z"/>
      <circle class="c-eye" cx="3.4" cy="-34.6" r="0.85"/>
      <g class="c-limb c-arm-f"><rect class="c-skin" x="-1.9" y="-27" width="3.8" height="12" rx="1.9"/></g>
    </g></g></g>`;

  return `<svg class="j-svg" viewBox="0 0 360 160" preserveAspectRatio="xMidYMax slice" role="img" focusable="false">
    <rect class="sky" x="0" y="0" width="360" height="160"/>
    <g class="stars">${stars.map(([x, y], i) => `<circle class="star" cx="${x}" cy="${y}" r="${i % 3 ? 0.8 : 1.2}" style="animation-delay:-${i * 0.6}s"/>`).join('')}</g>
    <circle class="sun-halo" cx="306" cy="32" r="22"/><circle class="sun" cx="306" cy="32" r="13"/>
    <g class="clouds">${cloud(30, 1, 70, 10)}${cloud(52, 0.75, 90, 55)}${cloud(22, 0.6, 110, 80)}</g>
    <g class="j-far">
      <path class="hill-2" d="M-20 110 C40 82 110 90 180 102 S300 78 380 96 S520 84 600 98 S720 80 800 94 V160 H-20Z"/>
      <path class="hill-1" d="M-20 120 C70 102 150 110 220 116 S360 98 440 112 S600 102 680 114 S760 106 800 112 V160 H-20Z"/>
    </g>
    <g class="j-world">${back}</g>
    ${character}
    <g class="j-world">${front}</g>
  </svg>`;
}

export function createJourney(host, L, opts = {}) {
  const WALK_MS = Number(opts.walk_ms) || 1300;
  const EASE = EASINGS[opts.easing] || EASINGS.standard;
  const CONFETTI = opts.confetti !== false;
  const el = document.createElement('div');
  el.className = 'journey';
  el.dataset.world = '0';
  el.innerHTML = `
    <div class="j-scene">${sceneSVG(L)}
      <div class="j-toast" role="status" aria-live="polite"></div>
      <div class="j-confetti" aria-hidden="true"></div>
    </div>
    <div class="j-meta">
      <span class="j-label">${L.journey} · <b class="j-count">0</b>/${TOTAL}</span>
      <span class="j-world-name">${L.worlds[0]}</span>
    </div>
    <div class="j-track" aria-hidden="true"><div class="j-fill"></div>
      ${[0, 1, 2, 3].map((i) => `<i class="j-node" data-i="${i}" style="left:${(i * 100) / 3}%"></i>`).join('')}
    </div>
    <div class="j-ticks" aria-hidden="true"><span>${L.jStart}</span><span>5</span><span>10</span><span>${L.goal}</span></div>`;
  host.appendChild(el);

  const svg = el.querySelector('.j-svg');
  const worlds = [...el.querySelectorAll('.j-world')];
  const far = el.querySelector('.j-far');
  const char = el.querySelector('.j-char');
  const fill = el.querySelector('.j-fill');
  const count = el.querySelector('.j-count');
  const worldName = el.querySelector('.j-world-name');
  const nodes = [...el.querySelectorAll('.j-node')];
  const flags = [...el.querySelectorAll('.ms')];
  const toastEl = el.querySelector('.j-toast');
  const confetti = el.querySelector('.j-confetti');
  let cur = 0;
  let toastTimer = null;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
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

  function celebrate() {
    char.classList.add('cheer');
    burst(46);
  }

  async function setProgress(n, { animate = false } = {}) {
    n = Math.max(0, Math.min(TOTAL, n));
    const prev = cur;
    cur = n;
    const motion = animate && !reduced() && n !== prev;
    el.classList.toggle('instant', !motion);
    const tr = motion ? `transform ${WALK_MS}ms ${EASE}` : 'none';
    fill.style.transitionDuration = motion ? `${WALK_MS}ms` : '0ms';
    for (const g of worlds) {
      g.style.transition = tr;
      g.style.transform = `translateX(${-n * STEP}px)`;
    }
    far.style.transition = tr;
    far.style.transform = `translateX(${-n * PAR}px)`;

    const w = n >= 10 ? 2 : n >= 5 ? 1 : 0;
    el.dataset.world = String(w);
    count.textContent = n;
    worldName.textContent = L.worlds[w];
    fill.style.width = `${(n / TOTAL) * 100}%`;
    nodes.forEach((nd) => nd.classList.toggle('on', n >= Number(nd.dataset.i) * 5));
    flags.forEach((f) => f.classList.toggle('reached', n >= Number(f.dataset.n)));
    svg.setAttribute('aria-label', L.journeyAria.replace('{n}', n));
    if (n < TOTAL) char.classList.remove('cheer');

    if (motion) {
      char.classList.add('walking');
      await sleep(WALK_MS);
      char.classList.remove('walking');
    }
    if (animate && n > prev && [5, 10, 15].includes(n)) {
      const f = flags.find((x) => Number(x.dataset.n) === n);
      if (f) { f.classList.remove('pop'); void f.getBBox(); f.classList.add('pop'); }
      toast(L.milestones[n]);
      if (n === TOTAL) celebrate(); else burst(16);
    } else if (!animate && n === TOTAL) {
      char.classList.add('cheer');
    }
  }

  return { el, setProgress, celebrate };
}
