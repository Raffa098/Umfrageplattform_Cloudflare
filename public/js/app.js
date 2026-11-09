import { STRINGS } from './i18n.js';
import { createJourney } from './journey.js';
import { xmasSVG } from './xmas.js';
import { isReduced, isDark, setTheme, setMotion, applyDefaultTheme } from './prefs.js';

// ---------------------------------------------------------------- Grundlagen
const params = new URLSearchParams(location.search);
// Testteilnahmen entstehen ausschließlich im geschützten Adminbereich; ?ts=<Sitzung> öffnet eine solche Sitzung.
const TEST_SESSION = /^[0-9a-f-]{36}$/.test(params.get('ts') || '') ? params.get('ts') : null;
const URL_LANG = ['de', 'en'].includes(params.get('lang')) ? params.get('lang') : null;
const SOURCE = (params.get('src') || params.get('source') || '').slice(0, 64) || null;
const KEY = 'decision-study:v2';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const store = (() => {
  try {
    const s = TEST_SESSION ? sessionStorage : localStorage;
    s.setItem('__probe', '1');
    s.removeItem('__probe');
    return s;
  } catch {
    return null;
  }
})();
const loadState = () => {
  try { return JSON.parse(store?.getItem(KEY) || 'null') || {}; } catch { return {}; }
};
const saveState = () => {
  try { store?.setItem(KEY, JSON.stringify(S)); } catch { /* privat/blockiert: läuft trotzdem */ }
};

let S = TEST_SESSION ? { pid: TEST_SESSION } : loadState(); // { pid, lang, group, answered, seen, extrasDone, code }
let L = STRINGS.de;
let cfg = null;
let journey = null;
let timing = null;

const $screen = document.getElementById('screen');
const $treat = document.getElementById('treatment');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const twoFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

function setLang(l) {
  L = STRINGS[l] || STRINGS.de;
  document.documentElement.lang = l;
  document.title = `${L.brand} · ${L.title}`;
  document.getElementById('brand').textContent = L.brand;
  document.getElementById('testBadge').textContent = L.test;
  const m = document.getElementById('motionBtn'), t = document.getElementById('themeBtn');
  m.title = m.ariaLabel = L.motionToggle;
  t.title = t.ariaLabel = L.themeToggle;
}

// Nach der Antwort den "Weiter"-Knopf sicher in den sichtbaren Bereich scrollen (auch über Safari-Leiste/Home-Bereich)
function revealNext(btn) {
  requestAnimationFrame(() => {
    const r = btn.getBoundingClientRect();
    const vh = window.visualViewport?.height || innerHeight;
    // iOS-Safari: untere Leiste (~70 px) überdeckt den Rand -> Knopf höher ins Bild holen
    const inset = window.CSS?.supports?.('-webkit-touch-callout', 'none') ? 112 : 28;
    if (r.bottom > vh - inset) window.scrollBy({ top: r.bottom - vh + inset + 12, behavior: isReduced() ? 'auto' : 'smooth' });
  });
}

// Schalter für Darkmode und reduzierte Bewegung (Barrierefreiheit); Nutzerwahl wird gemerkt
const motionBtn = document.getElementById('motionBtn');
const syncMotionBtn = () => motionBtn.setAttribute('aria-pressed', String(isReduced()));
motionBtn.addEventListener('click', () => { setMotion(isReduced() ? 'full' : 'reduced'); syncMotionBtn(); });
document.getElementById('themeBtn').addEventListener('click', () => setTheme(isDark() ? 'light' : 'dark'));
syncMotionBtn();

// ---------------------------------------------------------------- Server
async function api(path, { method = 'GET', body, auth = true, retries = 2 } = {}) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(path, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(auth && S.pid ? { authorization: `Bearer ${S.pid}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const e = new Error(data.error || String(res.status));
        e.status = res.status;
        e.data = data;
        if (data.error === 'offline') { e.offline = true; offlineScreen(data.text); }
        throw e;
      }
      return data;
    } catch (e) {
      if ((e.status && e.status < 500) || e.offline || i >= retries) throw e;
      await sleep(700 * (i + 1));
    }
  }
}

// Seite wurde im Admin offline genommen: Hinweis statt Umfrage (auch mitten in der Teilnahme)
let offlineShown = false;
function offlineScreen(text) {
  if (offlineShown) return;
  offlineShown = true;
  setTreatmentVisible(false);
  return messageScreen(L.offlineTitle, (text && text[document.documentElement.lang]) || L.offlineText, 'pause');
}

// Ereignisprotokoll (Frage sichtbar, Pausen, Zwischenseiten …), gebündelt übertragen
let queue = [];
function ev(type, item_id = null, data = null) {
  if (!S.pid) return;
  queue.push({ type, item_id, t: Date.now(), data });
  if (queue.length >= 20) flush();
}
async function flush(keepalive = false) {
  if (!queue.length || !S.pid) return;
  const events = queue.splice(0);
  try {
    await fetch('/api/events', {
      method: 'POST',
      keepalive,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${S.pid}` },
      body: JSON.stringify({ events }),
    });
  } catch {
    if (!keepalive) queue.unshift(...events);
  }
}
setInterval(flush, 8000);

document.addEventListener('visibilitychange', () => {
  const now = performance.now();
  if (document.hidden) {
    ev('page_hidden', timing?.itemId ?? null);
    if (timing && timing.hiddenAt === null) timing.hiddenAt = now;
    flush(true);
  } else {
    ev('page_visible', timing?.itemId ?? null);
    if (timing && timing.hiddenAt !== null) {
      timing.hidden += now - timing.hiddenAt;
      timing.hiddenAt = null;
    }
  }
});
window.addEventListener('pagehide', () => flush(true));

// ---------------------------------------------------------------- Bildschirmwechsel
function animDone(el, ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('animationend', onEnd);
      resolve();
    };
    const onEnd = (e) => { if (e.target === el) finish(); };
    el.addEventListener('animationend', onEnd);
    setTimeout(finish, isReduced() ? 30 : ms);
  });
}
async function leave() {
  if (!$screen.childElementCount) return;
  $screen.classList.remove('enter');
  $screen.classList.add('leave');
  await animDone($screen, 260);
}
async function enter(html) {
  $screen.classList.remove('leave');
  $screen.innerHTML = html;
  window.scrollTo(0, 0);
  $screen.classList.remove('enter');
  void $screen.offsetWidth;
  $screen.classList.add('enter');
  await animDone($screen, 460);
  $screen.classList.remove('enter');
}
async function show(html) {
  await leave();
  await enter(html);
}
const setTreatmentVisible = (v) => { $treat.hidden = !v; };

const ICONS = {
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  hand: '<svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
};
const MOT_ICONS = [
  '<path d="M24 7l4.6 10.4L40 18.6l-8.6 7.6L33.8 38 24 32.2 14.2 38l2.4-11.8L8 18.6l11.4-1.2z"/>',
  '<path d="M12 25l8 8 16-17"/>',
  '<path d="M14 40V9"/><path d="M14 10h20l-4 7 4 7H14"/>',
];

// ---------------------------------------------------------------- Bildschirme
function langScreen() {
  setTreatmentVisible(false);
  return show(`
    <section class="hero stagger">
      <div class="hero-art" aria-hidden="true" style="--i:0">
        <svg viewBox="0 0 120 120">
          <path class="ha-path ha-a" d="M60 104 C60 80 60 70 60 62 C60 48 36 44 30 22"/>
          <path class="ha-path ha-b" d="M60 62 C60 48 84 44 90 22"/>
          <circle class="ha-node ha-n0" cx="60" cy="104" r="6"/>
          <circle class="ha-node ha-n1" cx="30" cy="22" r="7"/>
          <circle class="ha-node ha-n2" cx="90" cy="22" r="7"/>
          <circle class="ha-dot" r="4"><animateMotion dur="3.6s" repeatCount="indefinite" path="M60 104 C60 80 60 70 60 62 C60 48 84 44 90 22"/></circle>
        </svg>
      </div>
      <h1 style="--i:1">${STRINGS.de.brand}<span class="sub">${STRINGS.de.langTitle} · ${STRINGS.de.langSub}</span></h1>
      <p class="muted" style="--i:2">${STRINGS.de.langPrompt}</p>
      <div class="lang-grid" style="--i:3">
        ${['de', 'en'].map((l) => `
          <button type="button" class="lang" data-l="${l}">
            <span class="lang-code">${l.toUpperCase()}</span>
            <span class="lang-txt"><b>${l === 'de' ? 'Deutsch' : 'English'}</b><small>${STRINGS[l].langHint}</small></span>
            <span class="chev" aria-hidden="true">→</span>
          </button>`).join('')}
      </div>
    </section>`).then(() => {
    $screen.querySelectorAll('.lang').forEach((b) => b.addEventListener('click', () => {
      S.lang = b.dataset.l;
      setLang(S.lang);
      consentScreen();
    }, { once: true }));
  });
}

async function loadConfig(lang, group = '') {
  cfg = await api(`/api/config?lang=${lang}${group ? `&group=${group}` : ''}`, { auth: !!S.pid });
  applyDefaultTheme(cfg.default_theme);
  // Testfreigabe: Neustart jederzeit möglich (Teilnahme wiederholen)
  const rb = document.getElementById('restartBtn');
  rb.hidden = !cfg.open_test;
  rb.title = rb.ariaLabel = L.restart;
}

// Testfreigabe: lokale Sitzung verwerfen und von vorn beginnen
function restart() {
  const lang = S.lang || URL_LANG || 'de';
  S = { lang };
  saveState();
  queue = [];
  journey = null;
  timing = null;
  $treat.innerHTML = '';
  document.getElementById('testBadge').hidden = true;
  setLang(lang);
  return consentScreen();
}
document.getElementById('restartBtn').addEventListener('click', restart);

async function consentScreen() {
  try {
    await loadConfig(S.lang);
  } catch (e) {
    if (e.offline) return;
    return errorScreen(consentScreen);
  }
  if (!cfg.active) return messageScreen(L.pausedTitle, L.pausedText, 'pause');

  await show(`
    <section class="consent stagger">
      <p class="kicker" style="--i:0">${L.consentKicker}</p>
      <h1 style="--i:1">${L.consentTitle}</h1>
      <p class="lead" style="--i:2">${L.consentLead}</p>
      <ul class="facts" style="--i:3">
        ${L.facts.map(([ic, t, d]) => `<li><span class="fact-ic">${ICONS[ic]}</span><span><b>${t}</b><span>${d}</span></span></li>`).join('')}
      </ul>
      <details class="more" style="--i:4"><summary>${L.moreInfo}</summary><p>${L.moreText}</p>
        ${cfg.privacy_extra ? `<p style="white-space:pre-line">${esc(cfg.privacy_extra)}</p>` : ''}
        ${cfg.contact ? `<p><b>${L.contact}:</b> ${esc(cfg.contact)}</p>` : ''}</details>
      ${cfg.open_test ? `
      <div class="pick" style="--i:5">
        <p class="pick-title">${L.pickTitle}</p>
        <div class="pick-grid" role="radiogroup" aria-label="${L.pickTitle}">
          ${['random', 'control', 'gamification', 'motivation'].map((g) => `<button type="button" class="pick-opt" role="radio" aria-checked="${g === 'random'}" data-g="${g}">${L.pickNames[g]}</button>`).join('')}
        </div>
        <p class="warn-small">${L.pickHint}</p>
      </div>` : ''}
      <label class="check" style="--i:5"><input type="checkbox" id="agree"><span class="box" aria-hidden="true"></span><span>${L.consentCheck}</span></label>
    </section>
    <div class="actions"><button class="btn btn-primary" id="startBtn" disabled>${L.start}<span class="arrow" aria-hidden="true">→</span></button></div>`);

  const agree = $screen.querySelector('#agree');
  const btn = $screen.querySelector('#startBtn');
  let pickedGroup = null; // nur bei Testfreigabe; sonst ordnet der Server zu
  $screen.querySelector('.pick-grid')?.addEventListener('click', (e) => {
    const b = e.target.closest('.pick-opt');
    if (!b) return;
    pickedGroup = b.dataset.g === 'random' ? null : b.dataset.g;
    $screen.querySelectorAll('.pick-opt').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
  });
  agree.addEventListener('change', () => {
    btn.disabled = !agree.checked;
    if (agree.checked) btn.classList.add('ready');
  });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.classList.add('busy');
    try {
      const r = await api('/api/session', {
        method: 'POST',
        auth: false,
        body: {
          lang: S.lang, consent: true, source: SOURCE, group: pickedGroup,
          device: {
            mobile: matchMedia('(pointer: coarse)').matches,
            w: innerWidth, h: innerHeight,
            dark: isDark(),
            reduced: isReduced(),
          },
        },
      });
      S = { pid: r.id, lang: r.lang, group: r.group, answered: 0, seen: [], extrasDone: [] };
      saveState();
      document.getElementById('testBadge').hidden = !r.test;
      await loadConfig(r.lang, r.group);
      ev('language', null, { lang: r.lang, src: SOURCE });
      ev('consent');
      renderTreatment();
      advance(0);
    } catch (e) {
      if (e.offline) return;
      btn.classList.remove('busy');
      btn.disabled = false;
      if (e.status === 503) return messageScreen(L.pausedTitle, L.pausedText, 'pause');
      flashError(L.errorText);
    }
  });
}

function renderTreatment() {
  $treat.innerHTML = '';
  journey = null;
  if (S.group === 'gamification') {
    journey = createJourney($treat, L, cfg.journey);
    journey.setProgress(S.answered || 0, { animate: false });
  } else {
    // Kontrolle und Motivation: identischer, neutraler Kopfbereich
    $treat.innerHTML = `<div class="neutral"><strong>${L.neutralTitle}</strong><span>${L.neutralSub}</span></div>`;
  }
}

async function advance(answered, { walk = false } = {}) {
  const total = cfg.total;
  if (journey && walk) {
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: isReduced() ? 'auto' : 'smooth' });
    // Animation läuft erst nach gespeicherter Antwort; der Timer der nächsten Frage startet erst danach
    await Promise.all([leave(), journey.setProgress(answered, { animate: true })]);
    if (answered >= total) await sleep(isReduced() ? 300 : 4800); // Ziel genießen: Feuerwerk läuft im Hintergrund
  } else {
    await leave();
  }
  if (answered >= total) return afterMain();
  if (S.group === 'motivation') {
    const slot = { 0: 0, 5: 1, 10: 2 }[answered];
    if (slot !== undefined && !(S.seen || []).includes(answered)) return interstitial(slot, answered);
  }
  return questionScreen(cfg.items[answered]);
}

// ---------------------------------------------------------------- Hauptfragen
function questionHTML(item) {
  const choice = item.kind === 'choice';
  const opts = item.options.map((o, i) => {
    const v = choice ? 'ABCD'[i] : String(i + 1);
    return `<button type="button" class="opt" role="radio" aria-checked="false" data-v="${v}">
      <span class="opt-key">${v}</span><span class="opt-label">${esc(o)}</span><span class="opt-dot" aria-hidden="true"></span></button>`;
  }).join('');
  const short = !item.passage && item.text.length < 90;
  return `
    <article class="q">
      <p class="q-meta">${fmt(L.questionOf, { n: item.position, total: cfg.total })}</p>
      ${item.passage ? `<div class="passage">${esc(item.passage)}</div>` : ''}
      <h1 class="q-text${short ? ' short' : ''}" id="qText">${esc(item.text)}</h1>
      <div class="opts" role="radiogroup" aria-labelledby="qText">${opts}</div>
      <p class="q-error" role="alert" hidden></p>
    </article>
    <div class="actions"><button class="btn btn-primary" id="nextBtn" disabled>${L.next}<span class="arrow" aria-hidden="true">→</span></button></div>`;
}

async function questionScreen(item) {
  setTreatmentVisible(true);
  await enter(questionHTML(item));
  const optsEl = $screen.querySelector('.opts');
  const btn = $screen.querySelector('#nextBtn');
  let selected = null;

  // Zeitmessung (performance.now) erst, wenn die Frage vollständig dargestellt ist
  await twoFrames();
  timing = { itemId: item.id, t0: performance.now(), first: null, changes: 0, hidden: 0, hiddenAt: document.hidden ? performance.now() : null };
  ev('question_visible', item.id);

  optsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.opt');
    if (!b || !timing || timing.itemId !== item.id) return;
    const v = b.dataset.v;
    if (v === selected) return;
    if (selected !== null) timing.changes++;
    if (timing.first === null) timing.first = performance.now();
    selected = v;
    optsEl.querySelectorAll('.opt').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
    if (btn.disabled) { btn.disabled = false; btn.classList.add('ready'); revealNext(btn); }
    ev('answer_select', item.id, { v });
  });

  let payload = null;
  btn.addEventListener('click', async () => {
    if (selected === null || btn.classList.contains('busy')) return;
    if (!payload) {
      // Antwortzeit wird beim ersten Klick auf "Weiter" fixiert (auch bei späteren Wiederholungen)
      const t = timing;
      timing = null;
      const now = performance.now();
      if (t.hiddenAt !== null) t.hidden += now - t.hiddenAt;
      payload = {
        item_id: item.id,
        value: selected,
        rt_ms: Math.round(now - t.t0),
        first_click_ms: t.first === null ? null : Math.round(t.first - t.t0),
        hidden_ms: Math.round(t.hidden),
        changes: t.changes,
      };
    }
    btn.classList.add('busy');
    optsEl.classList.add('locked');
    const errEl = $screen.querySelector('.q-error');
    errEl.hidden = true;
    try {
      const r = await api('/api/answer', { method: 'POST', body: payload, retries: 3 });
      S.answered = r.answered;
      saveState();
      advance(S.answered, { walk: true });
    } catch (e) {
      if (e.offline) return;
      if (e.status === 409 && e.data?.expected) {
        S.answered = e.data.expected - 1;
        saveState();
        if (journey) journey.setProgress(S.answered);
        return advance(S.answered);
      }
      if (e.status === 409 && e.data?.error === 'already_completed') return finishScreen(true);
      if (e.status === 401 || e.status === 404) { S = {}; saveState(); return langScreen(); }
      ev('save_error', item.id);
      btn.classList.remove('busy');
      errEl.textContent = L.saveError;
      errEl.hidden = false;
    }
  });
}

async function interstitial(slot, answered) {
  setTreatmentVisible(false);
  const m = cfg.motivation[slot];
  await enter(`
    <section class="mot stagger">
      <div class="mot-art" style="--i:0" aria-hidden="true">
        <span class="ring"></span><span class="ring r2"></span><span class="ring r3"></span>
        <span class="mot-core"><svg viewBox="0 0 48 48">${MOT_ICONS[slot]}</svg></span>
      </div>
      <p class="kicker warm" style="--i:1">${L.noteKicker}</p>
      <h1 class="mot-title" style="--i:2">${esc(m.title)}</h1>
      <p class="mot-text" style="--i:3">${esc(m.text)}</p>
    </section>
    <div class="actions"><button class="btn btn-warm ready" id="motBtn">${fmt(L.continueTo, { n: answered + 1 })}<span class="arrow" aria-hidden="true">→</span></button></div>`);
  const t0 = performance.now();
  ev('interstitial_shown', null, { slot });
  $screen.querySelector('#motBtn').addEventListener('click', async () => {
    S.seen = [...(S.seen || []), answered];
    saveState();
    ev('interstitial_done', null, { slot, ms: Math.round(performance.now() - t0) });
    await leave();
    questionScreen(cfg.items[answered]);
  }, { once: true });
}

// ---------------------------------------------------------------- Zusatzfragen (Manipulationschecks, Kontrollfragen)
async function afterMain() {
  setTreatmentVisible(false);
  const sections = ['manipulation', 'control', 'feedback']; // feedback = Smiley-Bewertung, direkt vor dem Abschluss
  const next = sections.find((s) => cfg.extras.some((e) => e.section === s) && !(S.extrasDone || []).includes(s));
  if (next) return extrasScreen(next);
  return completeSurvey();
}

// Smiley-Bewertung: 5 Gesichter von traurig bis sehr glücklich
const FACE_COLORS = ['#f26b5b', '#f4a259', '#f6d55c', '#b5df6a', '#5ec27a'];
const MOUTHS = [
  '<path d="M15 35 Q24 25 33 35" />',
  '<path d="M16 34 Q24 29 32 34" />',
  '<path d="M16.5 32 H31.5" />',
  '<path d="M15 29 Q24 38 33 29" />',
  '<path d="M13 28 H35 Q35 41.5 24 41.5 Q13 41.5 13 28Z" class="mouth-open"/><path d="M15.5 28.8 H32.5" class="teeth"/>',
];
const BROWS = ['<path class="brow" d="M11.5 13.5 L19.5 16.5 M36.5 13.5 L28.5 16.5" />', '', '', '', ''];
const SMILEYS = FACE_COLORS.map((c, i) => `<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="face" cx="24" cy="24" r="22" fill="${c}"/>${BROWS[i]}<circle class="eye" cx="17" cy="20" r="2.6"/><circle class="eye" cx="31" cy="20" r="2.6"/><g class="mouth">${MOUTHS[i]}</g></svg>`);

function extraHTML(e) {
  const tag = e.required ? '' : `<span class="opt-tag">${L.optional}</span>`;
  let body;
  if (e.kind === 'smiley') {
    body = `<div class="smileys" role="radiogroup" aria-labelledby="h-${e.id}" data-id="${e.id}">
        ${e.options.map((o, i) => `<button type="button" class="sm" role="radio" aria-checked="false" aria-label="${esc(o)}" data-v="${i + 1}">${SMILEYS[i]}</button>`).join('')}
      </div><p class="sm-label" aria-live="polite">&nbsp;</p>`;
  } else if (e.kind === 'choice' && e.options.length <= 5 && e.options.every((o) => o.length <= 8) && !(e.options.length === 5 && e.ordinal)) {
    // kurze Antworten (z. B. "1–2", "3–4", "5–6", "7+"): kompakt in einer Reihe
    body = `<div class="scale compact" style="grid-template-columns:repeat(${e.options.length},1fr)" role="radiogroup" aria-labelledby="h-${e.id}" data-id="${e.id}">
        ${e.options.map((o, i) => `<button type="button" class="sc" role="radio" aria-checked="false" data-v="${i + 1}">${esc(o)}</button>`).join('')}
      </div>`;
  } else if (e.kind === 'number') {
    body = `<input class="num" type="number" inputmode="numeric" pattern="[0-9]*" min="${e.min}" max="${e.max}" step="1" placeholder="${L.numberHint}" data-id="${e.id}" aria-labelledby="h-${e.id}">`;
  } else if (e.options.length === 5 && e.ordinal) {
    body = `<div class="scale" role="radiogroup" aria-labelledby="h-${e.id}" data-id="${e.id}">
        ${e.options.map((o, i) => `<button type="button" class="sc" role="radio" aria-checked="false" aria-label="${esc(o)}" data-v="${i + 1}">${i + 1}</button>`).join('')}
      </div>
      <div class="scale-legend"><span>1 = ${esc(e.options[0])}</span><span>5 = ${esc(e.options[4])}</span></div>`;
  } else {
    body = `<div class="opts" role="radiogroup" aria-labelledby="h-${e.id}" data-id="${e.id}">
        ${e.options.map((o, i) => `<button type="button" class="opt" role="radio" aria-checked="false" data-v="${i + 1}"><span class="opt-label">${esc(o)}</span><span class="opt-dot" aria-hidden="true"></span></button>`).join('')}
      </div>`;
  }
  return `<section class="xq" data-q="${e.id}"><h2 id="h-${e.id}">${esc(e.text)}${tag}</h2>${body}</section>`;
}

async function extrasScreen(section) {
  const items = cfg.extras.filter((e) => e.section === section);
  const head = section === 'manipulation' ? [L.xManipulation, L.xManipulationSub]
    : section === 'feedback' ? [L.xFeedback, L.xFeedbackSub] : [L.xControl, L.xControlSub];
  await enter(`
    <div class="xhead stagger"><p class="kicker" style="--i:0">${L.noteKicker}</p><h1 style="--i:1">${head[0]}</h1><p style="--i:2">${head[1]}</p></div>
    <div class="xlist">${items.map(extraHTML).join('')}</div>
    <p class="q-error" role="alert" hidden></p>
    <div class="actions"><button class="btn btn-primary" id="xBtn" disabled>${L.next}<span class="arrow" aria-hidden="true">→</span></button></div>`);
  ev('extras_shown', null, { section });

  const vals = {};
  const btn = $screen.querySelector('#xBtn');
  const refresh = (user) => {
    const ok = items.every((e) => !e.required || (vals[e.id] ?? '') !== '');
    const was = !btn.disabled;
    btn.disabled = !ok;
    if (ok) { btn.classList.add('ready'); if (user && !was) revealNext(btn); }
  };
  $screen.querySelector('.xlist').addEventListener('click', (ev2) => {
    const b = ev2.target.closest('[data-v]');
    if (!b) return;
    const grp = b.closest('[data-id]');
    vals[grp.dataset.id] = b.dataset.v;
    grp.querySelectorAll('[data-v]').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
    if (grp.classList.contains('smileys')) {
      grp.classList.add('has-sel');
      const lab = grp.parentElement.querySelector('.sm-label');
      if (lab) lab.textContent = b.getAttribute('aria-label'); // gewählte Bewertung als Text darunter
    }
    refresh(true);
  });
  $screen.querySelectorAll('input.num').forEach((inp) => inp.addEventListener('input', () => {
    const e = items.find((x) => x.id === inp.dataset.id);
    const n = inp.value === '' ? '' : Number(inp.value);
    vals[e.id] = n !== '' && Number.isInteger(n) && n >= e.min && n <= e.max ? String(n) : '';
    refresh(true);
  }));
  refresh();

  btn.addEventListener('click', async () => {
    if (btn.disabled || btn.classList.contains('busy')) return;
    btn.classList.add('busy');
    const err = $screen.querySelector('.q-error');
    err.hidden = true;
    try {
      await api('/api/extras', { method: 'POST', body: { section, answers: vals }, retries: 3 });
      S.extrasDone = [...(S.extrasDone || []), section];
      saveState();
      ev('extras_done', null, { section });
      await leave();
      afterMain();
    } catch (e) {
      if (e.offline) return;
      btn.classList.remove('busy');
      if (e.status === 401 || e.status === 404) { S = {}; saveState(); return langScreen(); }
      err.textContent = e.data?.error === 'invalid_value' || e.data?.error === 'required_missing' ? L.saveError : L.saveError;
      err.hidden = false;
    }
  });
}

// Abschluss: Code wird auf dem Gerät erzeugt; der Server speichert ihn ohne Personenbezug (Gewinnspiel-Trennung)
async function completeSurvey() {
  if (!S.code) { S.code = newCode(); saveState(); }
  for (let i = 0; i < 4; i++) {
    try {
      await api('/api/finish', { method: 'POST', body: { code: S.code }, retries: 3 });
      return finishScreen(false);
    } catch (e) {
      if (e.status === 409 && e.data?.error === 'code_taken') { S.code = newCode(); saveState(); continue; }
      if (e.status === 409 && e.data?.error === 'extras_missing') { S.extrasDone = (S.extrasDone || []).filter((x) => x !== e.data.section); saveState(); return extrasScreen(e.data.section); }
      if (e.offline) return;
      if (e.status === 401 || e.status === 404) { S = {}; saveState(); return langScreen(); }
      return errorScreen(completeSurvey);
    }
  }
  return errorScreen(completeSurvey);
}

async function finishScreen(already) {
  flush();
  const code = S.code || '';
  setTreatmentVisible(!already && !!journey);
  const redirect = cfg?.redirect_url ? cfg.redirect_url.replace('{code}', encodeURIComponent(code)) : '';
  const prize = cfg?.prize?.enabled ? cfg.prize : null;
  const mailHref = prize && code
    ? `mailto:${prize.email}?subject=${encodeURIComponent(L.prizeMailSubject)}&body=${encodeURIComponent(fmt(L.prizeMailBody, { code }))}` : '';
  await enter(`
    <section class="done stagger">
      <div class="done-check" style="--i:0" aria-hidden="true">
        <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28"/><path d="M20 33l8 8 16-17"/></svg>
      </div>
      <h1 style="--i:1">${already ? L.alreadyTitle : L.doneTitle}</h1>
      <p class="lead closing" style="--i:2">${esc(already ? L.alreadyText : (cfg?.closing_text || L.doneText))}</p>
      ${cfg?.christmas ? `<div class="xmas" style="--i:3" aria-hidden="true">${xmasSVG()}</div><p class="xmas-cap" style="--i:3">${L.xmas}</p>` : ''}
      ${code ? `
        <p class="code-label" style="--i:3">${L.codeLabel}</p>
        <div class="code-box" style="--i:3">
          <span class="code" id="code">${esc(code)}</span>
          <button type="button" class="btn-copy" id="copyBtn">${ICONS.copy}<span>${L.copy}</span></button>
        </div>` : `<p class="muted small" style="--i:3">${L.codeLost}</p>`}
      ${prize ? `
        <div class="prize" style="--i:5">
          <h3>${L.prizeTitle}</h3>
          <p>${L.prizeText} <span class="mail">${esc(prize.email)}</span></p>
          ${mailHref ? `<a class="btn btn-warm" href="${esc(mailHref)}">${L.prizeMail}</a>` : ''}
          <p class="warn-small">${L.prizeNote}</p>
          ${prize.terms ? `<details><summary>${L.prizeTerms}</summary><p style="white-space:pre-line">${esc(prize.terms)}</p></details>` : ''}
        </div>` : ''}
      ${cfg?.open_test ? `<button type="button" class="btn btn-warm" id="againBtn" style="--i:6;margin-top:18px;max-width:360px">${L.again}</button>` : ''}
      ${redirect ? `<a class="btn btn-ghost" style="--i:6" href="${esc(redirect)}" rel="noopener">${L.backToPlatform}<span class="arrow" aria-hidden="true">→</span></a>` : ''}
    </section>`);
  ev('finish_shown', null, { already });
  flush();
  $screen.querySelector('#againBtn')?.addEventListener('click', restart, { once: true });
  const copyBtn = $screen.querySelector('#copyBtn');
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const r = document.createRange();
      r.selectNodeContents($screen.querySelector('#code'));
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    }
    copyBtn.classList.add('ok');
    copyBtn.querySelector('span').textContent = L.copied;
  });
}

async function messageScreen(title, text, kind) {
  setTreatmentVisible(false);
  await show(`
    <section class="msg stagger">
      <div class="msg-ic ${kind}" style="--i:0" aria-hidden="true"></div>
      <h1 style="--i:1">${title}</h1>
      <p class="lead" style="--i:2">${text}</p>
    </section>`);
}

async function errorScreen(retryFn) {
  setTreatmentVisible(false);
  await show(`
    <section class="msg stagger">
      <div class="msg-ic offline" style="--i:0" aria-hidden="true"></div>
      <h1 style="--i:1">${L.errorTitle}</h1>
      <p class="lead" style="--i:2">${L.errorText}</p>
    </section>
    <div class="actions"><button class="btn btn-primary ready" id="retryBtn">${L.retry}</button></div>`);
  $screen.querySelector('#retryBtn').addEventListener('click', () => retryFn(), { once: true });
}

function flashError(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'alert');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ---------------------------------------------------------------- Start
async function boot() {
  setLang(S.lang || URL_LANG || 'de');

  if (S.pid) {
    try {
      const st = await api('/api/session');
      Object.assign(S, {
        group: st.group, lang: st.lang, answered: st.answered, seen: S.seen || [],
        extrasDone: st.extras_done || [],
      });
      saveState();
      setLang(st.lang);
      document.getElementById('testBadge').hidden = !st.test;
      await loadConfig(st.lang, st.group);
      if (st.completed) return finishScreen(true);
      ev('resume', null, { answered: st.answered });
      renderTreatment();
      return advance(S.answered);
    } catch (e) {
      if (e.status === 401 || e.status === 404) {
        S = {};
        saveState();
      } else {
        if (e.offline) return;
        return errorScreen(boot);
      }
    }
  }
  if (URL_LANG) {
    S.lang = URL_LANG;
    setLang(URL_LANG);
    return consentScreen();
  }
  return langScreen();
}

boot();
