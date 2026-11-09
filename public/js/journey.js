// Animierte Fortschrittsreise (nur Gamification-Gruppe).
// Forschungsintegrität: Fortschritt UND Punkte hängen ausschließlich von der Zahl beantworteter Fragen ab
// (gleich viele Punkte pro Frage – nie nach Tempo, Antwortinhalt oder Aufmerksamkeit).
// Reise: Wald -> Stadt mit Universität (Bachelor, nach Q5) -> Raketenstation (Master, nach Q10)
//        -> antikes griechisches Forum (Professor, nach Q15).
// Meilenstein-Effekte: Q5 Doktorhüte fliegen, Q10 Rakete startet im Hintergrund, Q15 Feuerwerk.
// Die Szene ist ein langer Streifen, der pro Frage um STEP verschoben wird, die Figur läuft an fester Stelle.

import { isReduced as reduced } from './prefs.js';
import { sceneSVG, STEP } from './scene.js';

const PAR_MID = 14;    // Parallaxe Hügel
const PAR_FAR = 7;     // Parallaxe Berge
const TOTAL = 15;
const NS = 'http://www.w3.org/2000/svg';
const EASINGS = {
  standard: 'cubic-bezier(.45,.05,.3,1)',
  linear: 'linear',
  soft: 'cubic-bezier(.25,.1,.25,1)',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const levelOf = (n) => (n >= 15 ? 3 : n >= 10 ? 2 : n >= 5 ? 1 : 0);

// ---------------------------------------------------------------- Icons
const I = {
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z"/></svg>',
  student: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.7-4 3.6-6 7.5-6s6.8 2 7.5 6"/></svg>',
  cap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5"/><path d="M22 9v6"/></svg>',
  master: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c3 3.2 4.2 6.4 4.2 9.5l2.3 3.3-3 .6H8.5l-3-.6L7.8 12c0-3.1 1.2-6.3 4.2-9.5z"/><circle cx="12" cy="10" r="1.6"/><path d="M10 18.2c.4 1.6 1 2.8 2 3.6 1-.8 1.6-2 2-3.6"/></svg>',
  prof: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l9-4.5L21 9"/><path d="M5 9v9M9.7 9v9M14.3 9v9M19 9v9"/><path d="M3 20.5h18M4.2 18h15.6"/></svg>',
};
// Student · Bachelor (Doktorhut) · Master (Rakete) · Professor (Tempel)
const RANK_ICONS = [I.student, I.cap, I.master, I.prof];
const CAP_SVG = `<svg viewBox="-12 -9 24 18" aria-hidden="true"><path class="fx-base" d="M-5.5 1.5V5.8Q0 8.6 5.5 5.8V1.5Z"/><path class="fx-board" d="M-11.5 0 L0 -5.6 L11.5 0 L0 5.6Z"/><path class="fx-tassel" d="M0 0 L9.5 2 V7.5"/><circle class="fx-tassel-b" cx="9.5" cy="8" r="1.4"/></svg>`;

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
    <div class="j-scene">${sceneSVG()}
      <div class="j-hud">
        <div class="j-pill j-pts-pill"><span class="j-ic gold">${I.star}</span><b class="j-pts">0</b><span class="j-unit">${L.points}</span></div>
        <div class="j-pill j-rank-pill" title="${L.ranks[0]}"><span class="j-ic j-rank-ic">${RANK_ICONS[0]}</span></div>
      </div>
      <div class="j-plus" aria-hidden="true">+${PPA}</div>
      <div class="j-ach" role="status" aria-live="polite"><span class="ach-ic">${I.cap}</span><span class="ach-txt"><b></b><small></small></span></div>
      <div class="j-caps" aria-hidden="true"></div>
      <div class="j-confetti" aria-hidden="true"></div>
    </div>
    <div class="j-ladder" aria-hidden="true">
      <div class="lad-line"><i class="lad-fill"></i></div>
      ${RANK_ICONS.map((ic, i) => `<div class="lad-node${i === 0 ? ' on' : ''}" data-i="${i}"><span class="lad-dot">${ic}</span></div>`).join('')}
    </div>`;
  host.appendChild(el);

  const q = (s) => el.querySelector(s);
  const svg = q('.j-svg');
  const worlds = [...el.querySelectorAll('.j-world')];
  const far = q('.j-far'), far2 = q('.j-far2');
  const char = q('.j-char');
  const fill = q('.lad-fill');
  const ptsEl = q('.j-pts'), ptsPill = q('.j-pts-pill');
  const rankIc = q('.j-rank-ic'), rankPill = q('.j-rank-pill');
  const nodes = [...el.querySelectorAll('.lad-node')];
  const plus = q('.j-plus');
  const ach = q('.j-ach');
  const confetti = q('.j-confetti');
  const capsLayer = q('.j-caps');
  const fire = q('.fx-fire');
  const rocketFx = q('.fxr');
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
    ach.querySelector('.ach-ic').innerHTML = RANK_ICONS[l];
    ach.querySelector('b').textContent = a.t;
    ach.querySelector('small').textContent = a.s;
    ach.classList.add('show');
    clearTimeout(achTimer);
    // im Finale kürzer, damit das Feuerwerk frei zu sehen ist
    achTimer = setTimeout(() => ach.classList.remove('show'), l === 3 ? 2200 : 3400);
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

  // ---- Meilenstein-Effekte (alle ohne Einfluss auf Messung; bei reduzierter Bewegung aus)
  // 1) Bachelor: klassische Doktorhüte fliegen in die Luft
  function throwCaps() {
    if (reduced()) return;
    for (let i = 0; i < 11; i++) {
      const s = document.createElement('span');
      s.className = 'fx-cap';
      s.style.cssText = `left:${rnd(15, 34)}%;--dx:${rnd(-60, 120).toFixed(0)}px;--h:${rnd(40, 80).toFixed(0)}px;--dur:${rnd(1.9, 2.8).toFixed(2)}s;--delay:${rnd(0, 0.55).toFixed(2)}s;--rot:${rnd(-620, 620).toFixed(0)}deg`;
      s.innerHTML = `<i>${CAP_SVG}</i>`;
      capsLayer.appendChild(s);
    }
    setTimeout(() => { capsLayer.textContent = ''; }, 4600);
  }

  // 2) Master: Rakete startet im Hintergrund (hinter den Hügeln, mit Flamme und Rauchspur)
  function launchRocket() {
    if (reduced()) return;
    rocketFx.classList.remove('go');
    void rocketFx.getBBox();
    rocketFx.classList.add('go');
    setTimeout(() => rocketFx.classList.remove('go'), 4200);
  }

  // 3) Professor: großes Feuerwerk im Hintergrund (Himmel wird dunkel, Raketen steigen, Funken regnen)
  const PALETTE = ['#ffd466', '#ff6b6b', '#5ad1ff', '#c58bff', '#7dffb2', '#ffffff', '#ff9ad5'];
  function fireworkBurst(x, y, color) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${x} ${y})`);
    const inner = document.createElementNS(NS, 'g');
    inner.setAttribute('class', 'fw-burst');
    const flash = document.createElementNS(NS, 'circle');
    flash.setAttribute('class', 'fw-flash');
    flash.setAttribute('r', '13');
    flash.setAttribute('fill', color);
    inner.appendChild(flash);
    // äußerer Ring (groß) + innerer Ring (weiß, kleiner) für ein volles Feuerwerk
    const rings = [{ n: 30, dist: rnd(42, 62), r: 2.1, c: color, w: 5 }, { n: 16, dist: rnd(22, 30), r: 1.6, c: '#ffffff', w: 1 }];
    for (const ring of rings) {
      for (let i = 0; i < ring.n; i++) {
        const p = document.createElementNS(NS, 'circle');
        p.setAttribute('class', 'fw-p');
        p.setAttribute('r', String(i % 3 ? ring.r : ring.r + 0.7));
        p.setAttribute('fill', i % ring.w === 0 ? '#ffffff' : ring.c);
        p.setAttribute('style', `--a:${((360 / ring.n) * i + rnd(-4, 4)).toFixed(1)}deg;--r:${(ring.dist * rnd(0.8, 1.1)).toFixed(1)}px`);
        inner.appendChild(p);
      }
    }
    g.appendChild(inner);
    fire.appendChild(g);
    setTimeout(() => g.remove(), 2400);
  }
  function fireworks() {
    if (reduced()) return;
    el.classList.add('fx-night');
    const total = 11;
    for (let i = 0; i < total; i++) {
      const delay = i * 380 + rnd(0, 140);
      const x = i >= total - 3 ? 70 + (i - (total - 3)) * 110 : rnd(50, 310);
      const y = rnd(30, 62);
      setTimeout(() => {
        const shell = document.createElementNS(NS, 'circle');
        shell.setAttribute('class', 'fw-shell');
        shell.setAttribute('cx', String(x));
        shell.setAttribute('cy', '112');
        shell.setAttribute('r', '1.7');
        shell.setAttribute('style', `--dy:${y - 112}px`);
        fire.appendChild(shell);
        setTimeout(() => { shell.remove(); fireworkBurst(x, y, PALETTE[i % PALETTE.length]); }, 540);
      }, delay);
    }
    setTimeout(() => el.classList.remove('fx-night'), total * 380 + 2600);
  }

  // Titel/Ebene setzen (Hut, Robe, Brille …), Rangleiste und Rang-Symbol aktualisieren
  function setLevel(l, pulse) {
    lvl = l;
    char.dataset.level = String(l);
    rankIc.innerHTML = RANK_ICONS[l];
    rankPill.title = L.ranks[l];
    el.dataset.level = String(l);
    nodes.forEach((nd) => nd.classList.toggle('on', Number(nd.dataset.i) <= l));
    if (pulse) { rankPill.classList.remove('bump'); void rankPill.offsetWidth; rankPill.classList.add('bump'); }
  }

  // Meilenstein: Figur springt, bekommt am höchsten Punkt den Titel, Urkunde + Karte + Effekt
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
    if (l === 1) { throwCaps(); burst(14); }
    else if (l === 2) { launchRocket(); burst(14); }
    else { char.classList.add('cheer'); fireworks(); burst(30); }
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

    // Welt: 0 Wald · 1 Stadt mit Universität · 2 Raketenstation · 3 antikes Forum
    el.dataset.world = String(levelOf(n));
    fill.style.width = `${(n / TOTAL) * 100}%`;

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
    svg.setAttribute('aria-label', `${L.journeyAria.replace('{n}', n)} · ${n * PPA} ${L.points} · ${L.ranks[lvl]}`);
  }

  return { el, setProgress, celebrate: () => levelUp(3) };
}
