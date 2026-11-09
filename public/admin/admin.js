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

function start() {
  $('#login').hidden = true;
  $('#app').hidden = false;
  showTab('overview');
}

// ------------------------------------------------------------ Tabs
function showTab(name) {
  $$('.tabs [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $$('.tab').forEach((s) => { s.hidden = s.id !== `tab-${name}`; });
  clearInterval(refreshTimer);
  if (name === 'overview') { loadOverview(); refreshTimer = setInterval(loadOverview, 30000); }
  if (name === 'settings') fillSettings();
  if (name === 'questions') renderQuestions();
  if (name === 'prize') loadPrize();
  if (name === 'preview') setupPreview();
  if (name === 'audit') loadAudit();
}
$$('.tabs [role=tab]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ------------------------------------------------------------ Übersicht
const pct = ([k, n]) => (n ? `<b>${((k / n) * 100).toFixed(1)} %</b><small>${k}/${n}</small>` : '<span class="muted">–</span>');
const dur = (s) => (s == null ? '–' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`);
const ms = (v) => (v == null ? '–' : `${(v / 1000).toFixed(1)} s`);

function fillVersions(versions, current) {
  for (const sel of [$('#ovVersion'), $('#expVersion')]) {
    const keep = sel.value;
    sel.innerHTML = '<option value="">Alle</option>' + versions.map((v) =>
      `<option value="${esc(v.version)}">${esc(v.version)}${v.version === current ? ' (aktuell)' : ''} · ${v.n}</option>`).join('');
    sel.value = versions.some((v) => v.version === keep) ? keep : '';
  }
}

function extraCell(meta, g) {
  if (!g) return '<span class="muted">–</span>';
  if (meta.ordinal) return `<b>Ø ${g.mean}</b><small>n=${g.n}</small>`;
  const dist = Object.entries(g.dist).sort(([a], [b]) => a - b).map(([k, n]) => `${k}: ${n}`).join(' · ');
  return `<b>${dist}</b><small>n=${g.n}</small>`;
}
function extrasTable(sel, d, section) {
  const metas = d.extras_meta.filter((m) => m.section === section);
  $(sel).innerHTML = `<thead><tr><th>Item</th>${Object.values(GROUPS).map((g) => `<th>${g}</th>`).join('')}</tr></thead><tbody>${
    metas.length ? metas.map((m) => `<tr><td class="txt"><b>${esc(m.id)}</b> ${esc(m.text)}</td>${
      Object.keys(GROUPS).map((g) => `<td>${extraCell(m, d.extras[m.id]?.[g])}</td>`).join('')}</tr>`).join('')
      : '<tr><td colspan="4" class="muted">Keine Items konfiguriert.</td></tr>'}</tbody>`;
}

async function loadOverview() {
  const q = new URLSearchParams({ include_test: $('#ovTest').checked ? '1' : '0' });
  if ($('#ovVersion').value) q.set('version', $('#ovVersion').value);
  let d;
  try { d = await api(`/api/admin/stats?${q}`); } catch { return; }
  fillVersions(d.versions, d.current_version);
  $('#mismatchBanner').hidden = !d.catalog_mismatch;
  const t = d.total;
  const rate = t.started ? Math.round((t.completed / t.started) * 100) : 0;
  $('#ovTiles').innerHTML = [
    ['Gestartet', t.started, `DE ${d.langs.de} · EN ${d.langs.en}`],
    ['Abgeschlossen', t.completed, `${rate} % Abschlussquote · ${t.main_completed} mit 15 Fragen`],
    ['Laufend', t.in_progress, 'aktiv in den letzten Minuten'],
    ['Abgebrochen', t.abandoned, 'inaktiv, nicht abgeschlossen'],
  ].map(([l, v, s]) => `<div class="tile"><span>${l}</span><b>${v}</b><small>${s}</small></div>`).join('');

  const rows = Object.entries(d.groups);
  $('#ovGroups').innerHTML = `<thead><tr><th>Gruppe</th><th>Gestartet</th><th>Anteil</th><th>Abgeschl.</th><th>Median Antwortzeit</th><th>Speeding</th><th>Bogus</th><th>Consistency</th><th>Comprehension</th><th>Median Dauer</th></tr></thead>
    <tbody>${rows.map(([g, a]) => `<tr><th><span class="dot ${g}"></span>${GROUPS[g]}</th><td>${a.started}</td>
      <td>${t.started ? Math.round((a.started / t.started) * 100) : 0} %</td><td>${a.completed}</td><td>${ms(a.median_rt_ms)}</td>
      <td>${pct(a.speeding)}</td><td>${pct(a.bogus)}</td><td>${pct(a.consistency)}</td><td>${pct(a.comprehension)}</td><td>${dur(a.median_duration_s)}</td></tr>`).join('')}</tbody>`;
  $('#ovBlocks').innerHTML = `<thead><tr><th>Gruppe</th><th>Block 1 (Q1–5)</th><th>Block 2 (Q6–10)</th><th>Block 3 (Q11–15)</th></tr></thead>
    <tbody>${rows.map(([g, a]) => `<tr><th><span class="dot ${g}"></span>${GROUPS[g]}</th>${a.blocks.map((b) => `<td>${pct(b)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  extrasTable('#ovManip', d, 'manipulation');
  extrasTable('#ovControl', d, 'control');
  $('#ovUpdated').textContent = `Stand ${new Date(d.generated_at).toLocaleTimeString('de-DE')}`;
}
$('#ovRefresh').addEventListener('click', loadOverview);
$('#ovTest').addEventListener('change', loadOverview);
$('#ovVersion').addEventListener('change', loadOverview);

// ------------------------------------------------------------ Einstellungen
function updateHeader() {
  $('#studyState').textContent = `${settings.study_active ? 'Aktiv' : 'Pausiert'}${settings.test_mode ? ' · Testmodus' : ''} · ${settings.experiment_version}`;
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
  f.test_mode.checked = s.test_mode;
  f.experiment_version.value = s.experiment_version;
  f.sf_de.value = s.speeding_factor.de;
  f.sf_en.value = s.speeding_factor.en;
  f.c_rule.value = s.consistency.rule;
  f.c_min.value = s.consistency.min_diff;
  f.abandon.value = s.abandon_after_min;
  f.j_walk.value = s.journey.walk_ms;
  f.j_ease.value = s.journey.easing;
  f.j_conf.checked = s.journey.confetti;
  f.default_theme.value = s.default_theme;
  f.contact_de.value = s.contact.de;
  f.contact_en.value = s.contact.en;
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
    test_mode: f.test_mode.checked,
    experiment_version: f.experiment_version.value.trim(),
    speeding_factor: { de: Number(f.sf_de.value), en: Number(f.sf_en.value) },
    consistency: { rule: f.c_rule.value, min_diff: Number(f.c_min.value) },
    abandon_after_min: Number(f.abandon.value),
    journey: { walk_ms: Number(f.j_walk.value), easing: f.j_ease.value, confetti: f.j_conf.checked },
    default_theme: f.default_theme.value,
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
      <label class="field"><span>Abschnitt</span><select data-f="section"><option value="manipulation">Manipulationscheck</option><option value="control">Kontrollfrage</option></select></label>
      <span class="chip">${e.kind === 'number' ? 'Zahl' : 'Auswahl'}</span>
      <div class="xe-actions"><button type="button" class="btn-sm" data-act="up" aria-label="nach oben">↑</button><button type="button" class="btn-sm" data-act="down" aria-label="nach unten">↓</button><button type="button" class="btn-sm danger" data-act="del">Löschen</button></div>
    </div>
    <div class="grid-2">${['de', 'en'].map((l) => `<div>
      <label class="field"><span>Fragetext (${l.toUpperCase()})</span><textarea data-f="text_${l}" rows="2" maxlength="400">${esc(e[l].text)}</textarea></label>
      ${e.kind === 'choice' ? `<label class="field"><span>Optionen (${l.toUpperCase()}), eine pro Zeile</span><textarea data-f="opts_${l}" rows="${Math.max(3, e[l].options.length)}">${esc(lines(e[l].options))}</textarea></label>` : ''}
    </div>`).join('')}</div>
    ${e.kind === 'number' ? `<div class="row"><label class="field"><span>Minimum</span><input type="number" data-f="min" value="${e.min ?? 0}"></label><label class="field"><span>Maximum</span><input type="number" data-f="max" value="${e.max ?? 100}"></label></div>` : ''}
    <div class="xe-flags">
      <label class="toggle"><input type="checkbox" data-f="visible" ${e.visible ? 'checked' : ''}><span></span>Sichtbar</label>
      <label class="toggle"><input type="checkbox" data-f="required" ${e.required ? 'checked' : ''}><span></span>Pflicht</label>
      <label class="toggle"><input type="checkbox" data-f="ordinal" ${e.ordinal ? 'checked' : ''}><span></span>Ø sinnvoll (Skala)</label>
      <span class="xe-groups">Gruppen: ${Object.entries(GROUPS).map(([g, n]) => `<label><input type="checkbox" data-g="${g}" ${e.groups.includes(g) ? 'checked' : ''}> ${n}</label>`).join('')}</span>
    </div>`;
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
  const extras = $$('#extraQs .xe').map((d) => {
    const v = (f) => d.querySelector(`[data-f=${f}]`);
    const kind = d.dataset.kind;
    const x = {
      id: v('id').value.trim(), section: v('section').value, kind,
      visible: v('visible').checked, required: v('required').checked, ordinal: v('ordinal').checked,
      groups: $$('[data-g]', d).filter((c) => c.checked).map((c) => c.dataset.g),
      de: { text: v('text_de').value, options: kind === 'choice' ? unlines(v('opts_de').value) : [] },
      en: { text: v('text_en').value, options: kind === 'choice' ? unlines(v('opts_en').value) : [] },
    };
    if (kind === 'number') { x.min = Number(v('min').value); x.max = Number(v('max').value); }
    return x;
  });
  const msg = $('#qMsg');
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
$('#expForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const q = new URLSearchParams();
  for (const k of ['level', 'sep', 'group', 'lang', 'version', 'block', 'item']) if (f[k].value) q.set(k, f[k].value);
  if (f.completed_only.checked) q.set('completed_only', '1');
  if (f.include_test.checked) q.set('include_test', '1');
  const msg = $('#expMsg');
  say(msg, 'Export wird erstellt …');
  try {
    say(msg, `Heruntergeladen: ${await download(`/api/admin/export?${q}`, 'export.csv')}`, 'ok');
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
