import { barChart, lineChart, wilson } from '/admin/charts.js';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GROUPS = { control: 'Kontrolle', gamification: 'Gamification', motivation: 'Motivation' };
const TYPES = { rating: 'Einschätzung', decision: 'Entscheidung', consistency_a: 'Konsistenz A', consistency_b: 'Konsistenz B', comprehension: 'Comprehension', bogus: 'Bogus' };
const TK = 'study-admin-token';

let token = null;
try { token = sessionStorage.getItem(TK); } catch { /* ignore */ }
let settings = null;
let catalog = [];
let frozen = false;
let refreshTimer = null;

async function api(path, { method = 'GET', body, raw = false } = {}) {
  const res = await fetch(path, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    logout('Schlüssel ungültig oder abgelaufen.');
    throw new Error('unauthorized');
  }
  if (raw) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || `HTTP ${res.status}`);
    e.data = data;
    throw e;
  }
  return data;
}

async function download(path, fallbackName) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '')?.[1] || fallbackName;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return name;
}

function say(el, text, kind = '') {
  el.hidden = false;
  el.className = `msg-line ${kind}`;
  el.textContent = text;
}
const errText = (err) =>
  err.message === 'version_frozen'
    ? `Version „${err.data.version}“ ist eingefroren (${err.data.participants} echte Teilnahmen). Geändert werden sollte: ${err.data.fields.join(', ')} – bitte dafür zuerst eine neue Experimentversion eintragen und speichern.`
    : err.message === 'invalid_setting' ? `Ungültiger Wert: ${err.data.field}` : `Fehler: ${err.message}`;

// ------------------------------------------------------------ Anmeldung
function logout(msg) {
  token = null;
  try { sessionStorage.removeItem(TK); } catch { /* ignore */ }
  clearInterval(refreshTimer);
  $('#app').hidden = true;
  $('#login').hidden = false;
  if (msg) { $('#loginError').textContent = msg; $('#loginError').hidden = false; }
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  token = $('#tokenInput').value.trim();
  $('#loginError').hidden = true;
  try {
    await loadSettings();
    try { sessionStorage.setItem(TK, token); } catch { /* ignore */ }
    start();
  } catch (err) {
    if (err.message !== 'unauthorized') { $('#loginError').textContent = 'Server nicht erreichbar.'; $('#loginError').hidden = false; }
  }
});
$('#logoutBtn').addEventListener('click', () => logout());

// Teilnehmerseite online/offline schalten (Offline braucht eine zweite Bestätigung, Online sofort)
let offlineArmed = false;
$('#siteBtn').addEventListener('click', async () => {
  const btn = $('#siteBtn');
  const goOffline = settings.site_online;
  if (goOffline && !offlineArmed) {
    offlineArmed = true;
    btn.textContent = 'Wirklich offline? Erneut klicken';
    setTimeout(() => { offlineArmed = false; if (settings) btn.textContent = settings.site_online ? 'Offline nehmen' : 'Online nehmen'; }, 4000);
    return;
  }
  offlineArmed = false;
  btn.disabled = true;
  try {
    await api('/api/admin/settings', { method: 'PUT', body: { site_online: !goOffline } });
    await loadSettings();
    if (!$('#tab-settings').hidden) fillSettings();
  } catch (err) {
    btn.textContent = `Fehler: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
});

function start() {
  restoreFilters();
  $('#login').hidden = true;
  $('#app').hidden = false;
  showTab('overview');
}

// ------------------------------------------------------------ Tabs
function showTab(name) {
  $$('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('.tab').forEach((s) => { s.hidden = s.id !== `tab-${name}`; });
  clearInterval(refreshTimer);
  $('#filterBar').hidden = !['overview', 'export'].includes(name);
  if (name === 'overview') { loadOverview(); refreshTimer = setInterval(loadOverview, 30000); }
  if (name === 'export') renderExportFiles();
  if (name === 'settings') fillSettings();
  if (name === 'questions') renderQuestions();
  if (name === 'prize') loadPrize();
  if (name === 'preview') setupPreview();
  if (name === 'audit') loadAudit();
}
$$('.tabs [role=tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ------------------------------------------------------------ Filter (gemeinsam für Übersicht und Export)
const FILTER_KEYS = ['version', 'group', 'lang', 'status', 'mode', 'from', 'to'];
function filterParams() {
  const f = $('#filterBar');
  const q = new URLSearchParams();
  for (const k of FILTER_KEYS) if (f[k].value) q.set(k, f[k].value);
  return q;
}
$('#filterBar').addEventListener('submit', (e) => e.preventDefault());
$('#filterBar').addEventListener('change', () => { saveFilters(); refreshCurrent(); });
$('#fReset').addEventListener('click', () => { $('#filterBar').reset(); saveFilters(); refreshCurrent(); });
$('#ovRefresh').addEventListener('click', () => refreshCurrent());
function saveFilters() {
  try { sessionStorage.setItem('study-admin-filters', JSON.stringify(Object.fromEntries(filterParams()))); } catch { /* ignorieren */ }
}
function restoreFilters() {
  try {
    const o = JSON.parse(sessionStorage.getItem('study-admin-filters') || '{}');
    for (const k of FILTER_KEYS) if (o[k]) $('#filterBar')[k].value = o[k];
  } catch { /* ignorieren */ }
}
function refreshCurrent() {
  const tab = $$('.tabs [role=tab]').find((b) => b.getAttribute('aria-selected') === 'true')?.dataset.tab;
  if (tab === 'overview') loadOverview();
  if (tab === 'export') renderExportFiles();
}

// ------------------------------------------------------------ Übersicht
const GCOL = { control: 'var(--g-control)', gamification: 'var(--g-gamification)', motivation: 'var(--g-motivation)' };
const GLAB = { control: '1 · Kontrolle', gamification: '2 · Gamification', motivation: '3 · Motivation' };
const GSERIES = Object.keys(GLAB).map((k) => ({ key: k, label: GLAB[k], color: GCOL[k] }));
const SMALL_N = 30;
const pctTxt = (v) => `${(v * 100).toFixed(v < 0.1 && v > 0 ? 1 : 0)} %`;
const pct = ([k, n]) => (n ? `<b>${((k / n) * 100).toFixed(1)} %</b><small>${k}/${n}${n < SMALL_N ? ' · kleines n' : ''}</small>` : '<span class="muted">NA</span>');
const dur = (s) => (s == null ? '–' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`);
const ms = (v) => (v == null ? '–' : `${(v / 1000).toFixed(1)} s`);
let lastStats = null;
let statusAxis = 'group';

function fillVersions(versions, current) {
  const sel = $('#fVersion');
  const keep = sel.value;
  sel.innerHTML = '<option value="">Alle</option>' + versions.map((v) =>
    `<option value="${esc(v.version)}">${esc(v.version)}${v.version === current ? ' (aktuell)' : ''} · ${v.n}</option>`).join('');
  sel.value = versions.some((v) => v.version === keep) ? keep : '';
}

function extraCell(meta, g) {
  if (!g) return '<span class="muted">–</span>';
  const na = g.na ? `<small>NA: ${g.na}</small>` : '';
  if (!g.n) return `<span class="muted">NA</span>${na}`;
  if (meta.ordinal) return `<b>Ø ${g.mean}</b><small>n=${g.n}${g.n < SMALL_N ? ' · kleines n' : ''}</small>${na}`;
  const dist = Object.entries(g.dist).sort(([a], [b]) => a - b).map(([k, n]) => `${k}: ${n}`).join(' · ');
  return `<b>${dist}</b><small>n=${g.n}</small>${na}`;
}
function extrasTable(sel, d, section) {
  const metas = d.extras_meta.filter((m) => m.section === section);
  $(sel).innerHTML = `<thead><tr><th>Item</th>${GSERIES.map((g) => `<th>${g.label}</th>`).join('')}</tr></thead><tbody>${
    metas.length ? metas.map((m) => `<tr><td class="txt"><b>${esc(m.id)}</b> ${esc(m.text)}</td>${
      Object.keys(GLAB).map((g) => `<td>${extraCell(m, d.extras[m.id]?.[g])}</td>`).join('')}</tr>`).join('')
      : '<tr><td colspan="4" class="muted">Keine Items konfiguriert.</td></tr>'}</tbody>`;
}

function drawStatusChart(d) {
  const G = Object.keys(GLAB);
  const STAT = [
    { key: 'started', label: 'Teilgenommen', color: 'var(--s-start)' },
    { key: 'completed', label: 'Abgeschlossen', color: 'var(--s-done)' },
    { key: 'abandoned', label: 'Abgebrochen', color: 'var(--s-abandon)' },
  ];
  const num = (g, k) => (g === 'all' ? d.total[k] : d.groups[g][k]);
  if (statusAxis === 'group') {
    barChart($('#chStatus'), {
      cats: G.map((g) => ({ label: GLAB[g], sub: `n = ${d.groups[g].started}` })), series: STAT,
      values: G.map((g) => Object.fromEntries(STAT.map((s) => [s.key, num(g, s.key)]))),
      aria: 'Anzahl Teilgenommen, Abgeschlossen, Abgebrochen je Gruppe',
      tip: G.map((g) => Object.fromEntries(STAT.map((s) => [s.key, `${s.label}: ${num(g, s.key)} von ${d.groups[g].started} Starts`]))),
    });
  } else {
    barChart($('#chStatus'), {
      cats: STAT.map((s) => ({ label: s.label })), series: GSERIES,
      values: STAT.map((s) => Object.fromEntries(G.map((g) => [g, num(g, s.key)]))),
      aria: 'Anzahl je Status und Gruppe',
    });
  }
}
$$('[data-axis]').forEach((b) => b.addEventListener('click', () => {
  statusAxis = b.dataset.axis;
  $$('[data-axis]').forEach((x) => x.classList.toggle('seg-on', x === b));
  if (lastStats) drawStatusChart(lastStats);
}));

async function loadOverview() {
  let d;
  try { d = await api(`/api/admin/stats?${filterParams()}`); } catch { return; }
  lastStats = d;
  fillVersions(d.versions, d.current_version);
  $('#mismatchBanner').hidden = !d.catalog_mismatch;
  const t = d.total;
  const G = Object.keys(GLAB);
  const rate = t.started ? Math.round((t.completed / t.started) * 100) : 0;
  $('#ovTiles').innerHTML = [
    ['Teilgenommen', t.started, `DE ${d.langs.de} · EN ${d.langs.en}`],
    ['Abgeschlossen', t.completed, `${rate} % von ${t.started} Starts · ${t.main_completed} mit 15 Fragen`],
    ['Abgebrochen', t.abandoned, `inaktiv > ${d.rules.abandon_after_min} Min., nicht abgeschlossen`],
    ['Laufend', t.in_progress, 'noch aktiv'],
    ['Median Dauer', dur(t.median_duration_s), 'Start bis Abschluss'],
  ].map(([l, v, s]) => `<div class="tile"><span>${l}</span><b>${v}</b><small>${s}</small></div>`).join('');

  // Warnungen: kleine Fallzahl, Ungleichgewicht zwischen den Gruppen
  const w = [];
  const ns = G.map((g) => d.groups[g].started);
  if (t.started === 0) w.push('Keine Teilnahmen im gewählten Filter.');
  else {
    if (ns.some((n) => n < SMALL_N)) w.push(`Kleine Fallzahl: mindestens eine Gruppe hat weniger als ${SMALL_N} Teilnahmen (${G.map((g, i) => `${GLAB[g]}: ${ns[i]}`).join(', ')}). Kennzahlen sind noch nicht belastbar.`);
    if (Math.max(...ns) - Math.min(...ns) > Math.max(2, 0.2 * Math.max(...ns))) w.push('Die Gruppen sind unausgeglichen besetzt (Randomisierung weicht auffällig von 1:1:1 ab). Ggf. Filter (Status, Version) prüfen.');
  }
  if (d.filters.mode !== 'prod') w.push(`Filter „Daten“: ${d.filters.mode === 'test' ? 'nur Testdaten' : 'Test und Produktiv gemischt'} – nicht für die endgültige Auswertung verwenden.`);
  $('#ovWarn').innerHTML = w.map((x) => `<div class="banner warn">${esc(x)}</div>`).join('');

  drawStatusChart(d);

  // Fortschritt: Anteil der Starts mit >= k beantworteten Fragen
  const ks = Array.from({ length: 15 }, (_, i) => i + 1);
  lineChart($('#chReach'), {
    cats: ks.map((k) => ({ label: `Q${k}` })), series: GSERIES, yMax: 1, fmt: (v) => `${Math.round(v * 100)} %`,
    values: ks.map((k) => Object.fromEntries(G.map((g) => [g, d.groups[g].started ? d.groups[g].reach[k] / d.groups[g].started : null]))),
    tip: ks.map((k) => Object.fromEntries(G.map((g) => [g, `${GLAB[g]}: ${d.groups[g].reach[k]} von ${d.groups[g].started} (${d.groups[g].started ? pctTxt(d.groups[g].reach[k] / d.groups[g].started) : 'NA'})`]))),
    aria: 'Anteil der Teilnehmenden mit mindestens k beantworteten Fragen je Gruppe',
  });

  // Antwortqualität mit 95-%-Intervall
  const Q = [['speeding', 'Speeding'], ['bogus', 'Bogus (Q14)'], ['consistency', 'Consistency (Q6/Q10)'], ['comprehension', 'Comprehension (Q9)']];
  const qv = Q.map(([k]) => Object.fromEntries(G.map((g) => { const [a, n] = d.groups[g][k]; return [g, n ? a / n : null]; })));
  barChart($('#chQuality'), {
    cats: Q.map(([, l]) => ({ label: l })), series: GSERIES, values: qv, yMax: undefined, fmt: (v) => `${Math.round(v * 100)} %`,
    ci: Q.map(([k]) => Object.fromEntries(G.map((g) => { const [a, n] = d.groups[g][k]; return [g, n ? wilson(a, n) : null]; }))),
    tip: Q.map(([k]) => Object.fromEntries(G.map((g) => { const [a, n] = d.groups[g][k]; return [g, `${GLAB[g]}: ${a}/${n}${n ? ` = ${pctTxt(a / n)}` : ''}`]; }))),
    aria: 'Anteil auffälliger Antworten je Gruppe',
  });

  const rows = Object.entries(d.groups);
  $('#ovGroups').innerHTML = `<thead><tr><th>Gruppe</th><th>Starts</th><th>Anteil</th><th>Abgeschl.</th><th>Abgebr.</th><th>Median Antwortzeit</th><th>Speeding</th><th>Bogus</th><th>Consistency</th><th>Comprehension</th><th>Median Dauer</th></tr></thead>
    <tbody>${rows.map(([g, a]) => `<tr><th><span class="dot ${g}"></span>${GLAB[g]}</th><td>${a.started}</td>
      <td>${t.started ? Math.round((a.started / t.started) * 100) : 0} %</td><td>${a.completed}</td><td>${a.abandoned}</td><td>${ms(a.median_rt_ms)}</td>
      <td>${pct(a.speeding)}</td><td>${pct(a.bogus)}</td><td>${pct(a.consistency)}</td><td>${pct(a.comprehension)}</td><td>${dur(a.median_duration_s)}</td></tr>`).join('')}</tbody>`;

  // Antwortzeit je Frage (Median) – nur Speeding-Items; Tabelle mit Quartilen und Speeding
  const sp = d.items.filter((i) => i.speeding);
  lineChart($('#chRt'), {
    cats: sp.map((i) => ({ label: i.id })), series: GSERIES, fmt: (v) => `${v.toFixed(0)} s`,
    values: sp.map((i) => Object.fromEntries(G.map((g) => [g, i.groups[g].median_ms == null ? null : i.groups[g].median_ms / 1000]))),
    tip: sp.map((i) => Object.fromEntries(G.map((g) => { const x = i.groups[g]; return [g, `${GLAB[g]}: Median ${ms(x.median_ms)} (Q1–Q3 ${ms(x.q1_ms)}–${ms(x.q3_ms)}), n=${x.n}`]; }))),
    aria: 'Median der Antwortzeit je Frage und Gruppe',
  });
  $('#ovItems').innerHTML = `<thead><tr><th>Frage</th><th>Typ</th>${GSERIES.map((g) => `<th>${g.label}<br><small>Median (Q1–Q3) · Speeding</small></th>`).join('')}</tr></thead><tbody>${
    d.items.map((i) => `<tr><th>${i.id}</th><td><span class="chip ${i.type}">${TYPES[i.type] || i.type}</span></td>${G.map((g) => {
      const x = i.groups[g];
      return `<td>${x.n ? `<b>${ms(x.median_ms)}</b><small>${ms(x.q1_ms)}–${ms(x.q3_ms)} · n=${x.n}${i.speeding && x.speeding[1] ? ` · Speeding ${x.speeding[0]}/${x.speeding[1]}` : ''}</small>` : '<span class="muted">NA</span>'}</td>`;
    }).join('')}</tr>`).join('')}</tbody>`;
  $('#ovBlocks').innerHTML = `<thead><tr><th>Gruppe</th><th>Block 1 (Q1–5)</th><th>Block 2 (Q6–10)</th><th>Block 3 (Q11–15)</th></tr></thead>
    <tbody>${rows.map(([g, a]) => `<tr><th><span class="dot ${g}"></span>${GLAB[g]}</th>${a.blocks.map((b) => `<td>${pct(b)}</td>`).join('')}</tr>`).join('')}</tbody>`;

  // Manipulationschecks: Mittelwerte als Balken (nur ordinale Items)
  const mc = d.extras_meta.filter((m) => m.section === 'manipulation' && !m.ordinal && m.kind === 'choice');
  const mm = d.extras_meta.filter((m) => m.section === 'manipulation' && m.ordinal);
  if (mc.length) {
    // Einfachauswahl: Anteil je Antwortoption und Gruppe (erwartet: höchste Quote bei der eigenen Bedingung)
    const m = mc[0];
    const share = (g, k) => { const x = d.extras[m.id]?.[g]; return x?.n ? (x.dist[k] || 0) / x.n : null; };
    const short = (t) => (t.length > 26 ? `${t.slice(0, 25)}…` : t);
    barChart($('#chManip'), {
      cats: m.options.map((o, i) => ({ label: `${i + 1} · ${short(o)}` })), series: GSERIES, yMax: 1, fmt: (v) => `${Math.round(v * 100)} %`,
      values: m.options.map((_, i) => Object.fromEntries(G.map((g) => [g, share(g, i + 1)]))),
      tip: m.options.map((o, i) => Object.fromEntries(G.map((g) => [g, `${GLAB[g]}: ${d.extras[m.id]?.[g]?.dist[i + 1] || 0} von ${d.extras[m.id]?.[g]?.n || 0} – ${o}`]))),
      aria: 'Anteil der gewählten Antworten im Manipulationscheck je Gruppe',
    });
  } else if (mm.length) {
    barChart($('#chManip'), {
      cats: mm.map((m) => ({ label: m.id })), series: GSERIES, yMax: 5, fmt: (v) => v.toFixed(1),
      values: mm.map((m) => Object.fromEntries(G.map((g) => [g, d.extras[m.id]?.[g]?.mean ?? null]))),
      tip: mm.map((m) => Object.fromEntries(G.map((g) => [g, `${GLAB[g]}: Ø ${d.extras[m.id]?.[g]?.mean ?? 'NA'} (n=${d.extras[m.id]?.[g]?.n ?? 0}) – ${m.text}`]))),
      aria: 'Mittelwerte der Manipulationschecks je Gruppe',
    });
  } else $('#chManip').innerHTML = '<p class="muted">Kein Manipulationscheck konfiguriert.</p>';
  extrasTable('#ovManip', d, 'manipulation');
  extrasTable('#ovControl', d, 'control');
  extrasTable('#ovFeedback', d, 'feedback');

  // Datenqualität
  const q = d.quality;
  const missing = q.items_expected - q.items_answered;
  const mob = t.mobile + t.desktop;
  const naCount = Object.values(d.extras).reduce((s, e) => s + Object.values(e).reduce((a, g) => a + g.na, 0), 0);
  $('#ovQuality').innerHTML = [
    ['Fehlende Hauptantworten', q.items_expected ? `${missing}` : '–', `${q.items_expected ? pctTxt(missing / q.items_expected) : 'NA'} von ${q.items_expected} erwarteten (Starts × 15)`],
    ['Speicherfehler', q.save_errors, `bei ${q.participants_with_errors} Teilnehmenden (Ereignis save_error)`],
    ['Wiederholungs-Verdacht', q.repeat_suspects, 'Browser hatte schon einen Abschluss (nur Hinweis)'],
    ['Gerät', mob ? `${Math.round((t.mobile / mob) * 100)} % mobil` : '–', `${t.mobile} mobil · ${t.desktop} Desktop · ${t.device_unknown} unbekannt`],
    ['Sprache', `${d.langs.de} DE · ${d.langs.en} EN`, 'Starts je Sprache'],
    ['Leere Zusatzantworten', naCount, 'optionale Zusatzfragen ohne Antwort (NA)'],
  ].map(([l, v, s]) => `<div class="tile"><span>${l}</span><b>${v}</b><small>${s}</small></div>`).join('');

  $('#ovDefs').innerHTML = `<thead><tr><th>Kennzahl</th><th>Definition</th><th>Nenner</th><th>Exportspalte</th></tr></thead><tbody>${
    d.definitions.map((k) => `<tr><th>${esc(k.name)}</th><td class="txt">${esc(k.definition)}</td><td class="txt">${esc(k.denominator)}</td><td class="txt"><code>${esc(k.export)}</code></td></tr>`).join('')}</tbody>`;
  $('#ovRules').textContent = `Aktive Regeln: Speeding-Faktor DE ${d.rules.speeding_factor.de} / EN ${d.rules.speeding_factor.en} s pro Wort · Wortzahl ${d.rules.word_count_mode === 'text' ? 'nur Text/Passage' : 'inkl. Antwortoptionen'} · Konsistenzregel ${d.rules.consistency.rule === 'diff' ? `|Q6 − (6 − Q10)| ≥ ${d.rules.consistency.min_diff}` : 'Q6/Q10 beide zugestimmt oder beide abgelehnt'}.`;
  $('#ovUpdated').textContent = `Stand ${new Date(d.generated_at).toLocaleTimeString('de-DE')}`;
}

// ------------------------------------------------------------ Einstellungen
function updateHeader() {
  $('#studyState').textContent = `${settings.study_active ? 'Aktiv' : 'Pausiert'}${settings.test_mode ? ' · Testmodus' : ''} · ${settings.experiment_version}`;
  const online = settings.site_online;
  $('#offlineBanner').hidden = online;
  const chip = $('#siteChip');
  chip.textContent = online ? 'Seite ONLINE' : 'Seite OFFLINE';
  chip.className = `site-chip ${online ? 'on' : 'off'}`;
  $('#siteBtn').textContent = online ? 'Offline nehmen' : 'Online nehmen';
  const ot = $('#openTestBanner');
  ot.hidden = !settings.open_test;
  const b = $('#frozenBanner');
  b.hidden = !frozen;
  b.className = 'banner warn';
  b.textContent = 'Version eingefroren: Es liegen echte Teilnahmen vor. Motivationstexte, Fragentexte, Zusatzfragen und Reise-Animation sind gesperrt – für Änderungen bitte eine neue Experimentversion vergeben.';
}

async function loadSettings() {
  const d = await api('/api/admin/settings');
  settings = d.settings;
  catalog = d.catalog;
  frozen = d.frozen;
  updateHeader();
  $('#expItem').innerHTML = '<option value="">Alle</option>' + catalog.map((c) => `<option value="${c.id}">${c.id} · ${TYPES[c.type]}</option>`).join('');
}

function fillSettings() {
  const f = $('#setForm');
  const s = settings;
  f.study_active.checked = s.study_active;
  f.site_online.checked = s.site_online;
  f.offline_de.value = s.offline_text.de;
  f.offline_en.value = s.offline_text.en;
  f.test_mode.checked = s.test_mode;
  f.open_test.checked = s.open_test;
  f.experiment_version.value = s.experiment_version;
  f.sf_de.value = s.speeding_factor.de;
  f.sf_en.value = s.speeding_factor.en;
  f.word_mode.value = s.word_count_mode;
  f.c_rule.value = s.consistency.rule;
  f.c_min.value = s.consistency.min_diff;
  f.abandon.value = s.abandon_after_min;
  f.j_walk.value = s.journey.walk_ms;
  f.j_ease.value = s.journey.easing;
  f.j_conf.checked = s.journey.confetti;
  f.j_pts.value = s.journey.points_per_answer;
  f.j_showpts.checked = !!s.journey.show_points;
  f.default_theme.value = s.default_theme;
  f.christmas_scene.checked = s.christmas_scene;
  f.contact_de.value = s.contact.de;
  f.contact_en.value = s.contact.en;
  f.pp_de.value = s.privacy_page.de;
  f.pp_en.value = s.privacy_page.en;
  const ph = (t) => (t.match(/\[[^\]]+\]/g) || []).length;
  $('#ppCount').textContent = `Offene Platzhalter in eckigen Klammern: DE ${ph(s.privacy_page.de)}, EN ${ph(s.privacy_page.en)} – vor dem echten Start alle ausfüllen.`;
  f.priv_de.value = s.privacy_extra.de;
  f.priv_en.value = s.privacy_extra.en;
  f.close_de.value = s.closing_text.de;
  f.close_en.value = s.closing_text.en;
  f.redirect_url.value = s.redirect_url;
  f.prize_enabled.checked = s.prize.enabled;
  f.prize_email.value = s.prize.email;
  f.terms_de.value = s.prize.terms.de;
  f.terms_en.value = s.prize.terms.en;
  const labels = ['Vor Frage 1', 'Nach Frage 5', 'Nach Frage 10'];
  $('#motFields').innerHTML = ['de', 'en'].map((l) => `<div class="mot-col"><h3>${l === 'de' ? 'Deutsch' : 'English'}</h3>
    ${s.motivation[l].map((m, i) => `<fieldset><legend>${labels[i]}</legend>
      <label class="field"><span>Überschrift</span><input name="mt_${l}_${i}" maxlength="200" value="${esc(m.title)}" required></label>
      <label class="field"><span>Text</span><textarea name="mx_${l}_${i}" maxlength="1000" rows="3">${esc(m.text)}</textarea></label></fieldset>`).join('')}</div>`).join('');
}

$('#setForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const mot = (l) => [0, 1, 2].map((i) => ({ title: f[`mt_${l}_${i}`].value, text: f[`mx_${l}_${i}`].value }));
  const body = {
    study_active: f.study_active.checked,
    site_online: f.site_online.checked,
    offline_text: { de: f.offline_de.value, en: f.offline_en.value },
    test_mode: f.test_mode.checked,
    open_test: f.open_test.checked,
    experiment_version: f.experiment_version.value.trim(),
    speeding_factor: { de: Number(f.sf_de.value), en: Number(f.sf_en.value) },
    word_count_mode: f.word_mode.value,
    privacy_page: { de: f.pp_de.value, en: f.pp_en.value },
    consistency: { rule: f.c_rule.value, min_diff: Number(f.c_min.value) },
    abandon_after_min: Number(f.abandon.value),
    journey: { walk_ms: Number(f.j_walk.value), easing: f.j_ease.value, confetti: f.j_conf.checked, show_points: f.j_showpts.checked, points_per_answer: Number(f.j_pts.value) },
    default_theme: f.default_theme.value,
    christmas_scene: f.christmas_scene.checked,
    motivation: { de: mot('de'), en: mot('en') },
    contact: { de: f.contact_de.value, en: f.contact_en.value },
    privacy_extra: { de: f.priv_de.value, en: f.priv_en.value },
    closing_text: { de: f.close_de.value, en: f.close_en.value },
    redirect_url: f.redirect_url.value.trim(),
    prize: { enabled: f.prize_enabled.checked, email: f.prize_email.value.trim(), terms: { de: f.terms_de.value, en: f.terms_en.value } },
  };
  const msg = $('#setMsg');
  try {
    const r = await api('/api/admin/settings', { method: 'PUT', body });
    await loadSettings();
    fillSettings();
    say(msg, r.changed.length ? `Gespeichert: ${r.changed.join(', ')}` : 'Keine Änderungen.', 'ok');
  } catch (err) {
    say(msg, errText(err), 'err');
  }
});

// ------------------------------------------------------------ Fragen (Hauptfragen + Zusatzfragen)
const lines = (a) => (a || []).join('\n');
const unlines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

function renderQuestions() {
  $('#mainQs').innerHTML = catalog.map((c) => `<details class="qd" data-id="${c.id}"><summary>
      <b>${c.id}</b><span class="chip ${c.type}">${TYPES[c.type]}</span><span class="qd-text">${esc(c.de.text.slice(0, 80))}${c.de.text.length > 80 ? '…' : ''}</span></summary>
    <div class="grid-2">${['de', 'en'].map((l) => `<div>
      <h3>${l === 'de' ? 'Deutsch' : 'English'}</h3>
      ${c[l].passage !== null ? `<label class="field"><span>Text / Passage</span><textarea data-k="passage" data-l="${l}" rows="3" maxlength="1500">${esc(c[l].passage)}</textarea></label>` : ''}
      <label class="field"><span>${c[l].passage !== null ? 'Frage' : 'Fragetext'}</span><textarea data-k="text" data-l="${l}" rows="${c[l].passage !== null ? 2 : 4}" maxlength="1500">${esc(c[l].text)}</textarea></label>
      <label class="field"><span>Antwortoptionen (${c[l].options.length} Zeilen)</span><textarea data-k="options" data-l="${l}" rows="${c[l].options.length}" maxlength="1500">${esc(lines(c[l].options))}</textarea></label>
    </div>`).join('')}</div>
    <p class="hint">${c.speeding ? `Speeding-Item · ${c.words.de} / ${c.words.en} Wörter` : 'Kein Speeding'} · Block ${c.block} · Typ und Messrolle (Konsistenz, Comprehension, Bogus) sind fest.</p></details>`).join('');

  $('#extraQs').innerHTML = '';
  settings.extras.forEach((e) => $('#extraQs').appendChild(extraRow(e)));
}

function extraRow(e, isNew = false) {
  const d = document.createElement('div');
  d.className = 'xe';
  d.dataset.kind = e.kind;
  d.innerHTML = `
    <div class="xe-head">
      <label class="field"><span>ID</span><input data-f="id" value="${esc(e.id)}" ${isNew ? '' : 'readonly'} maxlength="16" pattern="[A-Za-z][A-Za-z0-9_]*" required></label>
      <label class="field"><span>Abschnitt</span><select data-f="section"><option value="manipulation">Manipulationscheck</option><option value="control">Kontrollfrage</option><option value="feedback">Abschlussfrage (Smiley)</option></select></label>
      <span class="chip">${e.kind === 'number' ? 'Zahl' : e.kind === 'smiley' ? 'Smiley (5)' : 'Auswahl'}</span>
      <div class="xe-actions"><button type="button" class="btn-sm" data-act="up" aria-label="nach oben">↑</button><button type="button" class="btn-sm" data-act="down" aria-label="nach unten">↓</button><button type="button" class="btn-sm danger" data-act="del">Löschen</button></div>
    </div>
    <div class="grid-2">${['de', 'en'].map((l) => `<div>
      <label class="field"><span>Fragetext (${l.toUpperCase()})</span><textarea data-f="text_${l}" rows="2" maxlength="400">${esc(e[l].text)}</textarea></label>
      ${e.kind !== 'number' ? `<label class="field"><span>${e.kind === 'smiley' ? `Beschriftung der 5 Gesichter (${l.toUpperCase()}), von traurig bis glücklich` : `Optionen (${l.toUpperCase()}), eine pro Zeile`}</span><textarea data-f="opts_${l}" rows="${Math.max(3, e[l].options.length)}">${esc(lines(e[l].options))}</textarea></label>` : ''}
    </div>`).join('')}</div>
    ${e.kind === 'number' ? `<div class="row"><label class="field"><span>Minimum</span><input type="number" data-f="min" value="${e.min ?? 0}"></label><label class="field"><span>Maximum</span><input type="number" data-f="max" value="${e.max ?? 100}"></label></div>` : ''}
    <div class="xe-flags">
      <label class="toggle"><input type="checkbox" data-f="visible" ${e.visible ? 'checked' : ''}><span></span>Sichtbar</label>
      <label class="toggle"><input type="checkbox" data-f="required" ${e.required ? 'checked' : ''}><span></span>Pflicht</label>
      <label class="toggle"><input type="checkbox" data-f="ordinal" ${e.ordinal ? 'checked' : ''}><span></span>Ø sinnvoll (Skala)</label>
      ${e.kind === 'choice' ? `<label class="toggle"><input type="checkbox" data-f="multi" ${e.multi ? 'checked' : ''}><span></span>Mehrfachauswahl</label>` : ''}
      <span class="xe-groups">Gruppen: ${Object.entries(GROUPS).map(([g, n]) => `<label><input type="checkbox" data-g="${g}" ${e.groups.includes(g) ? 'checked' : ''}> ${n}</label>`).join('')}</span>
    </div>`;
  // Bedingung: Frage nur anzeigen, wenn eine andere Frage (z. B. der Smiley) im gewählten Bereich beantwortet wurde
  const refs = (settings?.extras || []).filter((x) => x.id !== e.id && (x.kind === 'smiley' || x.ordinal));
  const si = e.show_if || {};
  const faces = ['1 · Gar nicht gut', '2 · Eher nicht gut', '3 · Geht so', '4 · Eher gut', '5 · Sehr gut'];
  const cond = document.createElement('div');
  cond.className = 'xe-cond';
  cond.innerHTML = `<label class="field"><span>Anzeigen</span><select data-f="cond_item"><option value="">Immer</option>${refs.map((x) => `<option value="${esc(x.id)}">Nur wenn ${esc(x.id)} (${esc(x.de.text.slice(0, 34))}…) beantwortet mit …</option>`).join('')}</select></label>
    <label class="field"><span>von</span><select data-f="cond_min">${faces.map((t, k) => `<option value="${k + 1}">${t}</option>`).join('')}</select></label>
    <label class="field"><span>bis</span><select data-f="cond_max">${faces.map((t, k) => `<option value="${k + 1}">${t}</option>`).join('')}</select></label>`;
  d.appendChild(cond);
  const ci = cond.querySelector('[data-f=cond_item]');
  if (si.item && !refs.some((x) => x.id === si.item)) ci.insertAdjacentHTML('beforeend', `<option value="${esc(si.item)}">Nur wenn ${esc(si.item)} beantwortet mit …</option>`);
  ci.value = si.item || '';
  cond.querySelector('[data-f=cond_min]').value = si.min ?? 1;
  cond.querySelector('[data-f=cond_max]').value = si.max ?? 5;
  const syncCond = () => { cond.classList.toggle('off', !ci.value); };
  ci.addEventListener('change', syncCond);
  syncCond();
  d.querySelector('[data-f=section]').value = e.section;
  d.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'del') d.remove();
    if (b.dataset.act === 'up' && d.previousElementSibling) d.parentNode.insertBefore(d, d.previousElementSibling);
    if (b.dataset.act === 'down' && d.nextElementSibling) d.parentNode.insertBefore(d.nextElementSibling, d);
  });
  return d;
}

function newExtra(kind) {
  const used = new Set($$('#extraQs [data-f=id]').map((i) => i.value));
  let n = 1;
  while (used.has(`X${n}`)) n++;
  const opts = { de: ['Option 1', 'Option 2'], en: ['Option 1', 'Option 2'] };
  const e = {
    id: `X${n}`, section: 'control', kind, required: false, visible: true, ordinal: false, groups: Object.keys(GROUPS),
    min: 0, max: 100,
    de: { text: '', options: kind === 'choice' ? opts.de : [] },
    en: { text: '', options: kind === 'choice' ? opts.en : [] },
  };
  const row = extraRow(e, true);
  $('#extraQs').appendChild(row);
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
$('#addChoice').addEventListener('click', () => newExtra('choice'));
$('#addNumber').addEventListener('click', () => newExtra('number'));

$('#qForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const overrides = {};
  for (const d of $$('#mainQs .qd')) {
    const o = {};
    for (const l of ['de', 'en']) {
      const get = (k) => d.querySelector(`[data-k=${k}][data-l=${l}]`);
      o[l] = { text: get('text').value, options: unlines(get('options').value) };
      if (get('passage')) o[l].passage = get('passage').value;
    }
    overrides[d.dataset.id] = o;
  }
  let condError = null;
  const extras = $$('#extraQs .xe').map((d) => {
    const v = (f) => d.querySelector(`[data-f=${f}]`);
    const kind = d.dataset.kind;
    const x = {
      id: v('id').value.trim(), section: v('section').value, kind,
      visible: v('visible').checked, required: v('required').checked, ordinal: v('ordinal').checked,
      groups: $$('[data-g]', d).filter((c) => c.checked).map((c) => c.dataset.g),
      de: { text: v('text_de').value, options: kind !== 'number' ? unlines(v('opts_de').value) : [] },
      en: { text: v('text_en').value, options: kind !== 'number' ? unlines(v('opts_en').value) : [] },
    };
    if (kind === 'number') { x.min = Number(v('min').value); x.max = Number(v('max').value); }
    if (kind === 'choice' && v('multi')?.checked) x.multi = true;
    if (v('cond_item').value) {
      const lo = Number(v('cond_min').value), hi = Number(v('cond_max').value);
      x.show_if = { item: v('cond_item').value, ...(lo > 1 ? { min: lo } : {}), ...(hi < 5 ? { max: hi } : {}) };
      if (lo > hi || (lo === 1 && hi === 5)) condError = `Bedingung bei ${x.id}: „von“ darf nicht größer als „bis“ sein, und „1 bis 5“ wäre keine Einschränkung (dann „Immer“ wählen).`;
    }
    return x;
  });
  const msg = $('#qMsg');
  if (condError) return say(msg, condError, 'err');
  try {
    const r = await api('/api/admin/settings', { method: 'PUT', body: { catalog_overrides: overrides, extras } });
    await loadSettings();
    renderQuestions();
    say(msg, r.changed.length ? `Gespeichert: ${r.changed.join(', ')}` : 'Keine Änderungen.', 'ok');
  } catch (err) {
    say(msg, errText(err), 'err');
  }
});

// ------------------------------------------------------------ Gewinnspiel
async function loadPrize() {
  const d = await api('/api/admin/prize/stats');
  $('#prizeTiles').innerHTML = [['Gültige Codes', d.valid_codes, 'echte Abschlüsse'], ['Testcodes', d.test_codes, 'nicht gültig']]
    .map(([l, v, s]) => `<div class="tile"><span>${l}</span><b>${v}</b><small>${s}</small></div>`).join('');
}
$('#prizeExport').addEventListener('click', () => download('/api/admin/prize/export', 'gewinnspiel_codes.csv').catch(() => {}));
$('#prizeCheckForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('#prizeCode').value.trim().toUpperCase();
  const r = await api(`/api/admin/prize/check?code=${encodeURIComponent(code)}`);
  say($('#prizeResult'), r.valid ? `✓ Gültiger Code (Abschluss am ${r.day}).`
    : r.test ? 'Testcode – nicht gültig.' : r.reason === 'format' ? 'Ungültiges Format (8 Zeichen).' : 'Code unbekannt.', r.valid ? 'ok' : 'err');
});

// ------------------------------------------------------------ Export
const EXPORT_FILES = [
  { level: 'participants', file: 'participants.csv', text: 'Eine Zeile je Teilnahme: Gruppe, Zeitstempel (Einwilligung, Start, Abschluss), Status, Sprache, Gerät, Version.' },
  { level: 'responses_long', file: 'responses_long.csv', text: 'Eine Zeile je Person × Hauptfrage (auch unbeantwortete): Antwort, Zeitstempel, duration_ms, Wortzahl, Speeding-Schwelle und -Flag, correct.' },
  { level: 'codebook', file: 'questions_codebook.csv', text: 'Alle Fragen (Haupt- und Zusatzfragen): Texte DE/EN, Optionen, Kodierung, Wortzahlen beider Varianten, Rolle (Bogus, Consistency, Comprehension).' },
  { level: 'checks', file: 'checks_and_covariates.csv', text: 'Manipulationschecks, Kontext- und Zufriedenheitsfragen: eine Zeile je Person × Item (Antwort oder NA).' },
  { level: 'derived', file: 'derived_person.csv', text: 'Eine Zeile je Person, aus den Rohdaten berechnet: speeding_share (mit Nenner), Bogus-/Consistency-/Comprehension-Flags, mc_/cv_/fb_-Spalten.' },
  { level: 'events', file: 'events.csv', text: 'Optional: notwendige Ablaufereignisse (Frage sichtbar, Seite im Hintergrund, Speicherfehler …) ohne Mausbewegungen.' },
  { level: 'config', file: 'experiment_config.json', text: 'Archivierte Studienkonfiguration: Gruppen, Reihenfolge, Texte, Schwellen, Bewertungsregeln, Versionsstände, Kennzahl-Definitionen, Exportdatum.' },
];

function exportQuery(level) {
  const q = filterParams();
  q.set('level', level);
  q.set('profile', $('#expProfile').value);
  q.set('sep', $('#expSep').value);
  if (level === 'responses_long') {
    if ($('#expBlock').value) q.set('block', $('#expBlock').value);
    if ($('#expItem').value) q.set('item', $('#expItem').value);
  }
  return q;
}

function renderExportFiles() {
  $('#expFiles').innerHTML = EXPORT_FILES.map((f) => `<div class="file-row"><div><b>${f.file}</b><span>${esc(f.text)}</span></div>
    <button class="btn-sm" type="button" data-level="${f.level}">Herunterladen</button></div>`).join('');
}
$('#expFiles').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-level]');
  if (!b) return;
  const msg = $('#expMsg');
  say(msg, 'Export wird erstellt …');
  try {
    const name = await download(`/api/admin/export?${exportQuery(b.dataset.level)}`, `${b.dataset.level}.csv`);
    say(msg, `Heruntergeladen: ${name}`, 'ok');
  } catch (err) {
    say(msg, `Fehler: ${err.message}`, 'err');
  }
});
$('#expAll').addEventListener('click', async () => {
  const msg = $('#expMsg');
  const done = [];
  try {
    for (const f of EXPORT_FILES) {
      say(msg, `Export ${done.length + 1}/${EXPORT_FILES.length}: ${f.file} …`);
      done.push(await download(`/api/admin/export?${exportQuery(f.level)}`, f.file));
      await new Promise((r) => setTimeout(r, 400));
    }
    say(msg, `Analysepaket heruntergeladen (${done.length} Dateien). Falls der Browser Mehrfach-Downloads blockiert, bitte erlauben oder die Dateien einzeln laden.`, 'ok');
  } catch (err) {
    say(msg, `Fehler: ${err.message}`, 'err');
  }
});

// ------------------------------------------------------------ Testmodus (geschützt)
async function startTest() {
  const info = $('#pvInfo');
  try {
    const r = await api('/api/admin/test-session', {
      method: 'POST',
      body: { group: $('#pvGroup').value, lang: $('#pvLang').value, start_at: Number($('#pvStart').value) },
    });
    const url = `/?ts=${r.id}&lang=${r.lang}`;
    $('#pvFrame').src = url;
    $('#pvOpen').href = url;
    $('#pvOpen').hidden = false;
    say(info, `Testteilnahme gestartet · Gruppe: ${GROUPS[r.group]} · Start bei Q${r.start_at}`, 'ok');
  } catch (err) {
    say(info, `Fehler: ${err.message}`, 'err');
  }
}
function setupPreview() {
  const base = location.origin;
  $('#pvLinks').innerHTML = [
    ['Allgemein (Sprachwahl)', `${base}/`],
    ['Direkt Deutsch', `${base}/?lang=de`],
    ['Direkt Englisch', `${base}/?lang=en`],
    ['Beispiel Plattform', `${base}/?src=surveycircle`],
  ].map(([l, u]) => `<div class="link-row"><span>${l}</span><code>${esc(u)}</code><button type="button" class="btn-sm" data-copy="${esc(u)}">Kopieren</button></div>`).join('');
  if (!$('#pvFrame').src.includes('ts=')) startTest();
}
$('#pvReload').addEventListener('click', startTest);
$('#pvLinks').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Kopiert'; } catch { b.textContent = 'Bitte manuell kopieren'; }
  setTimeout(() => { b.textContent = 'Kopieren'; }, 1800);
});

let purgeArmed = false;
$('#purgeBtn').addEventListener('click', async () => {
  const b = $('#purgeBtn');
  const msg = $('#purgeMsg');
  if (!purgeArmed) {
    purgeArmed = true;
    b.textContent = 'Wirklich löschen? Erneut klicken';
    setTimeout(() => { purgeArmed = false; b.textContent = 'Alle Testteilnahmen löschen'; }, 4000);
    return;
  }
  purgeArmed = false;
  b.textContent = 'Alle Testteilnahmen löschen';
  try {
    const r = await api('/api/admin/purge-tests', { method: 'POST' });
    say(msg, `${r.deleted} Testteilnahmen gelöscht.`, 'ok');
  } catch (err) {
    say(msg, `Fehler: ${err.message}`, 'err');
  }
});

// ------------------------------------------------------------ Protokoll
const ACTIONS = { settings_update: 'Einstellungen geändert', export: 'Datenexport', prize_export: 'Code-Liste exportiert', purge_tests: 'Testdaten gelöscht' };
async function loadAudit() {
  const [v, d] = await Promise.all([api('/api/admin/versions'), api('/api/admin/audit')]);
  $('#versionTable').innerHTML = `<thead><tr><th>Version</th><th>Eingefroren am</th><th>Echte Teilnahmen</th><th>Katalog-Hash</th><th></th></tr></thead><tbody>${
    v.versions.length ? v.versions.map((r) => `<tr><td><b>${esc(r.version)}</b></td><td>${new Date(r.frozen_at).toLocaleString('de-DE')}</td><td>${r.participants}</td>
      <td><code>${esc(r.catalog_hash.slice(0, 12))}</code></td><td><button class="btn-sm" data-snap="${esc(r.version)}">Snapshot (JSON)</button></td></tr>`).join('')
      : '<tr><td colspan="5" class="muted">Noch keine Version eingefroren (erst mit dem ersten echten Teilnehmenden).</td></tr>'}</tbody>`;
  $('#auditTable').innerHTML = `<thead><tr><th>Zeit</th><th>Aktion</th><th>Details</th></tr></thead><tbody>${
    d.entries.length ? d.entries.map((e) => {
      let detail = e.detail || '';
      try {
        const o = JSON.parse(detail);
        detail = e.action === 'settings_update' ? Object.keys(o).join(', ')
          : e.action === 'export' ? `${o.level}, ${o.rows} Zeilen` : JSON.stringify(o);
      } catch { /* roh */ }
      return `<tr><td>${new Date(e.created_at).toLocaleString('de-DE')}</td><td>${ACTIONS[e.action] || esc(e.action)}</td><td class="txt">${esc(detail)}</td></tr>`;
    }).join('') : '<tr><td colspan="3" class="muted">Noch keine Einträge.</td></tr>'}</tbody>`;
}
$('#versionTable').addEventListener('click', (e) => {
  const b = e.target.closest('[data-snap]');
  if (b) download(`/api/admin/versions?version=${encodeURIComponent(b.dataset.snap)}`, 'config.json').catch(() => {});
});

// ------------------------------------------------------------ Start
if (token) {
  loadSettings().then(start).catch(() => logout());
}
