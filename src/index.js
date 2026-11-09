import { ITEMS, ITEM_BY_ID, TOTAL, ROLES, publicItems, effectiveItems } from './catalog.js';
import { DEFAULT_PRIVACY } from './privacy.js';
import { DEFAULT_EXTRAS, SECTIONS, ALL_GROUPS } from './extras.js';

const GROUPS = ALL_GROUPS;
const LANGS = ['de', 'en'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{8}$`);
const TEST_STARTS = [1, 6, 11, 15];
const EVENT_TYPES = new Set([
  'language', 'consent', 'question_visible', 'answer_select', 'page_hidden', 'page_visible',
  'interstitial_shown', 'interstitial_done', 'extras_shown', 'extras_done', 'resume', 'finish_shown', 'save_error',
]);
// Felder, die das Treatment bzw. die Messung beeinflussen: nach Start der echten Erhebung eingefroren
const FROZEN_KEYS = ['motivation', 'extras', 'catalog_overrides', 'journey', 'word_count_mode'];

export const DEFAULT_SETTINGS = {
  site_online: true, // Teilnehmerseite erreichbar (aus = Offline-Meldung für alle; Admin-Testmodus bleibt nutzbar)
  offline_text: {
    de: 'Diese Umfrage ist derzeit offline. Bitte versuche es später noch einmal.',
    en: 'This survey is currently offline. Please try again later.',
  },
  study_active: true,
  test_mode: false,
  open_test: false, // Testfreigabe: Teilnehmende wählen die Gruppe selbst und dürfen wiederholt teilnehmen (Daten = Testdaten)
  experiment_version: 'v1-pilot',
  speeding_factor: { de: 0.3, en: 0.3 }, // Sekunden pro Wort
  word_count_mode: 'text_options', // Speeding-Schwelle: Wortzahl inkl. Antwortoptionen (Pflichtenheft) oder 'text' = nur Text/Passage
  consistency: { rule: 'same_side', min_diff: 3 },
  abandon_after_min: 30,
  motivation: {
    de: [
      { title: 'Schön, dass du dabei bist!', text: 'Deine sorgfältigen Antworten machen diese Forschung erst möglich. Nimm dir Zeit und lies jede Frage in Ruhe – es zählt deine ehrliche Einschätzung.' },
      { title: 'Gut gemacht!', text: 'Das erste Drittel ist geschafft. Bleib konzentriert und nimm dir für jede Frage Zeit.' },
      { title: 'Stark – nur noch fünf Fragen!', text: 'Deine Aufmerksamkeit bis zum Schluss macht die Ergebnisse wirklich wertvoll.' },
    ],
    en: [
      { title: 'Great to have you here!', text: 'Your careful answers are what make this research possible. Take your time and read each question calmly – what matters is your honest assessment.' },
      { title: 'Well done!', text: 'You have completed the first third. Stay focused and take your time with each question.' },
      { title: 'Great work – only five questions left!', text: 'Your attention right to the end makes the results truly valuable.' },
    ],
  },
  extras: DEFAULT_EXTRAS,
  catalog_overrides: {},
  journey: { walk_ms: 1300, easing: 'standard', confetti: true, show_points: false, points_per_answer: 50 }, // Punktanzeige standardmäßig AUS (Tempo-Eindruck vermeiden); Punkte wären fix pro beantworteter Frage
  default_theme: 'system',
  christmas_scene: true, // Weihnachtsszene auf der Abschlussseite (im Admin abschaltbar)
  contact: { de: '', en: '' },
  privacy_extra: { de: '', en: '' },
  privacy_page: DEFAULT_PRIVACY, // Datenschutzerklärung (DSGVO) als eigene Seite; vor Erhebung Platzhalter ausfüllen
  closing_text: {
    de: 'Deine Antworten wurden vollständig gespeichert. Du kannst dieses Fenster jetzt schließen.',
    en: 'Your answers have been saved. You can close this window now.',
  },
  prize: { enabled: false, email: '', terms: { de: '', en: '' } },
  redirect_url: '',
};

class HttpError extends Error {
  constructor(status, code, extra = {}) {
    super(code);
    this.status = status;
    this.extra = extra;
  }
}

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
const nowIso = () => new Date().toISOString();
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const merge = (base, over) => {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
  return out;
};
const clampInt = (v, lo, hi) => {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return null;
  return Math.min(hi, Math.max(lo, Math.round(Number(v))));
};
const flag01 = (v) => (v === true ? 1 : v === false ? 0 : null);
const randInt = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
const sha256 = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const CATALOG_HASH_SRC = JSON.stringify(ITEMS.map((i) => [i.id, i.type, i.de, i.en]));

async function readJson(request, max = 16384) {
  const text = await request.text();
  if (text.length > max) throw new HttpError(413, 'payload_too_large');
  try {
    const data = JSON.parse(text || '{}');
    if (!isObj(data)) throw new Error();
    return data;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

async function getSettings(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'config'").first();
  return merge(DEFAULT_SETTINGS, row ? JSON.parse(row.value) : {});
}

async function audit(env, action, detail) {
  await env.DB.prepare('INSERT INTO audit_log (action, detail) VALUES (?, ?)')
    .bind(action, detail ? JSON.stringify(detail) : null)
    .run();
}

// ---------------------------------------------------------------- Zusatzfragen

const visibleExtras = (s, grp) => s.extras.filter((e) => e.visible && e.groups.includes(grp));
const publicExtra = (e, lang) => ({
  id: e.id, section: e.section, kind: e.kind, required: e.required, ordinal: e.ordinal,
  min: e.min ?? null, max: e.max ?? null, multi: !!e.multi, show_if: e.show_if ?? null, text: e[lang].text, options: e[lang].options,
});

// Bedingte Zusatzfrage (show_if): nur gefragt, wenn die Bezugsantwort vorhanden und <= max ist
const extraApplies = (e, values) => {
  if (!e.show_if) return true;
  const v = values[e.show_if.item];
  if (v === undefined || v === '') return false;
  const n = Number(v);
  return (e.show_if.max == null || n <= e.show_if.max) && (e.show_if.min == null || n >= e.show_if.min);
};

async function extrasState(env, p, s) {
  const { results } = await env.DB.prepare('SELECT item_id, value FROM extra_answers WHERE participant_id = ?').bind(p.id).all();
  const values = Object.fromEntries(results.map((r) => [r.item_id, r.value]));
  const have = new Set(results.map((r) => r.item_id));
  const items = visibleExtras(s, p.grp);
  const sections = {};
  for (const sec of SECTIONS) {
    const its = items.filter((e) => e.section === sec && extraApplies(e, values));
    sections[sec] = { total: its.length, done: its.every((e) => have.has(e.id)) };
  }
  return { items, sections, allDone: SECTIONS.every((sec) => sections[sec].done) };
}

// ---------------------------------------------------------------- Online/Offline der Teilnehmerseite

const bearer = (request) => (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

// Offline: öffentliche API gesperrt – außer für Admin-Testsitzungen (is_test), damit die Vorschau weiter funktioniert
async function requireOnline(request, env) {
  const s = await getSettings(env);
  if (s.site_online) return;
  const id = bearer(request);
  if (UUID_RE.test(id)) {
    const row = await env.DB.prepare('SELECT is_test FROM participants WHERE id = ?').bind(id).first();
    if (row?.is_test) return;
  }
  throw new HttpError(503, 'offline', { text: s.offline_text });
}

const escHtml = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function offlinePage(s) {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Offline</title>
<style>
:root{color-scheme:light dark;--bg:#eef3f7;--text:#0f2236;--muted:#56687a;--card:#fff;--bd:#d9e2ea}
@media (prefers-color-scheme:dark){:root{--bg:#09131f;--text:#e6edf4;--muted:#9caebf;--card:#111e2d;--bd:#213347}}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--text);font:16px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
.c{max-width:420px;text-align:center;background:var(--card);border:1px solid var(--bd);border-radius:24px;padding:36px 26px;box-shadow:0 10px 30px -12px rgba(0,0,0,.25)}
.i{width:64px;height:64px;margin:0 auto 18px;border-radius:20px;background:#e3f1ea;display:grid;place-items:center}
.i i{display:block;width:8px;height:24px;border-radius:4px;background:#4fae7b;box-shadow:16px 0 0 #4fae7b;transform:translateX(-8px)}
h1{font-size:1.4rem;margin:0 0 10px}p{margin:0 0 10px;color:var(--muted)}p:last-child{margin:0}
</style></head><body><main class="c"><div class="i" aria-hidden="true"><i></i></div>
<h1>Umfrage offline · Survey offline</h1><p>${escHtml(s.offline_text.de)}</p><p>${escHtml(s.offline_text.en)}</p></main></body></html>`;
  return new Response(html, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '3600', 'x-robots-tag': 'noindex' } });
}

// ---------------------------------------------------------------- Teilnehmende

async function getParticipant(request, env) {
  const id = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!UUID_RE.test(id)) throw new HttpError(401, 'no_session');
  const p = await env.DB.prepare('SELECT * FROM participants WHERE id = ?').bind(id).first();
  if (!p) throw new HttpError(404, 'unknown_session');
  return p;
}

const privacyVersion = async (s) => (await sha256(JSON.stringify(s.privacy_page))).slice(0, 8);

async function getPrivacy(env, url) {
  const lang = LANGS.includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'de';
  const s = await getSettings(env);
  return json({ lang, text: s.privacy_page[lang] || '', contact: s.contact[lang] || '', extra: s.privacy_extra[lang] || '', version: await privacyVersion(s) });
}

async function getConfig(env, url) {
  const lang = LANGS.includes(url.searchParams.get('lang')) ? url.searchParams.get('lang') : 'de';
  const group = GROUPS.includes(url.searchParams.get('group')) ? url.searchParams.get('group') : null;
  const s = await getSettings(env);
  return json({
    active: s.study_active || s.open_test,
    open_test: !!s.open_test,
    version: s.experiment_version,
    total: TOTAL,
    items: publicItems(lang, s.catalog_overrides),
    extras: group ? visibleExtras(s, group).map((e) => publicExtra(e, lang)) : [],
    motivation: s.motivation[lang],
    journey: s.journey,
    default_theme: s.default_theme,
    christmas: !!s.christmas_scene,
    contact: s.contact[lang] || '',
    privacy_extra: s.privacy_extra[lang] || '',
    privacy_version: await privacyVersion(s),
    closing_text: s.closing_text[lang] || '',
    prize: { enabled: s.prize.enabled && !!s.prize.email, email: s.prize.email, terms: s.prize.terms[lang] || '' },
    redirect_url: s.redirect_url || '',
  });
}

// 1:1:1 – neue Person kommt in die Gruppe mit den wenigsten Teilnahmen (Gleichstand: Zufall)
async function assignGroup(env, version, isTest) {
  const { results } = await env.DB.prepare(
    'SELECT grp, COUNT(*) AS n FROM participants WHERE version = ? AND is_test = ? GROUP BY grp',
  ).bind(version, isTest).all();
  const counts = Object.fromEntries(GROUPS.map((g) => [g, 0]));
  for (const r of results) counts[r.grp] = r.n;
  const min = Math.min(...Object.values(counts));
  const candidates = GROUPS.filter((g) => counts[g] === min);
  return candidates[randInt(candidates.length)];
}

async function ensureSnapshot(env, s) {
  const hash = await sha256(CATALOG_HASH_SRC);
  const snapshot = JSON.stringify({
    settings: s,
    catalog: effectiveItems(s.catalog_overrides).map((i) => ({ id: i.id, type: i.type, block: i.block, de: i.de, en: i.en })),
  });
  await env.DB.prepare('INSERT OR IGNORE INTO config_versions (version, snapshot, catalog_hash, frozen_at) VALUES (?, ?, ?, ?)')
    .bind(s.experiment_version, snapshot, hash, nowIso()).run();
}

async function insertParticipant(env, s, { group, lang, isTest, source, device = {} }) {
  const id = crypto.randomUUID();
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO participants (id, grp, lang, version, is_test, consent_at, source,
       device_mobile, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    // Datensparsamkeit: nur grobe Geräteart (Handy/Computer); Bildschirmgröße und Farbschema werden nicht gespeichert
    id, group, lang, s.experiment_version, isTest, now, source,
    flag01(device.mobile), now, now,
  ).run();
  return id;
}

// Öffentlich: keine Gruppenwahl, kein Testmodus über den Client – Zuteilung ausschließlich serverseitig
async function createSession(request, env) {
  const b = await readJson(request);
  if (!LANGS.includes(b.lang)) throw new HttpError(400, 'invalid_lang');
  if (b.consent !== true) throw new HttpError(400, 'consent_required');
  const s = await getSettings(env);
  if (!s.study_active && !s.test_mode && !s.open_test) throw new HttpError(503, 'study_paused');
  // Testfreigabe: Gruppenwahl durch Teilnehmende nur, wenn im Admin eingeschaltet; Daten sind dann immer Testdaten
  const isTest = s.test_mode || s.open_test ? 1 : 0;
  const group = s.open_test && GROUPS.includes(b.group) ? b.group : await assignGroup(env, s.experiment_version, isTest);
  const source = typeof b.source === 'string' ? b.source.replace(/[^\w.\-:]/g, '').slice(0, 64) || null : null;
  if (!isTest) await ensureSnapshot(env, s);
  const id = await insertParticipant(env, s, { group, lang: b.lang, isTest, source, device: isObj(b.device) ? b.device : {} });
  return json({ id, group, lang: b.lang, answered: 0, version: s.experiment_version, test: !!isTest }, 201);
}

// Admin: Testteilnahme mit gewählter Gruppe (oder Zufall) und optionalem Startpunkt (Q1/Q6/Q11/Q15)
async function adminTestSession(request, env) {
  const b = await readJson(request);
  const s = await getSettings(env);
  const lang = LANGS.includes(b.lang) ? b.lang : 'de';
  const group = GROUPS.includes(b.group) ? b.group : GROUPS[randInt(GROUPS.length)]; // 'random' oder ungültig -> Zufall
  const start = TEST_STARTS.includes(Number(b.start_at)) ? Number(b.start_at) : 1;
  const id = await insertParticipant(env, s, { group, lang, isTest: 1, source: 'admin-test' });
  const stmts = ITEMS.filter((it) => it.position < start).map((it) =>
    env.DB.prepare('INSERT INTO responses (participant_id, item_id, position, block, value, rt_ms) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, it.id, it.position, it.block, it.type === 'comprehension' ? 'A' : it.type === 'bogus' ? '4' : '3', 20000));
  if (stmts.length) await env.DB.batch(stmts);
  return json({ id, group, lang, start_at: start }, 201);
}

async function getSession(request, env) {
  const p = await getParticipant(request, env);
  const s = await getSettings(env);
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE participant_id = ?').bind(p.id).first();
  const ex = n >= TOTAL ? await extrasState(env, p, s) : null;
  return json({
    id: p.id, group: p.grp, lang: p.lang, version: p.version, answered: n,
    main_done: n >= TOTAL, completed: !!p.completed_at, test: !!p.is_test,
    extras_done: ex ? SECTIONS.filter((sec) => ex.sections[sec].done) : [],
  });
}

async function postAnswer(request, env) {
  const p = await getParticipant(request, env);
  const b = await readJson(request);
  const item = ITEM_BY_ID[b.item_id];
  if (!item) throw new HttpError(400, 'unknown_item');

  const { results } = await env.DB.prepare('SELECT item_id FROM responses WHERE participant_id = ?').bind(p.id).all();
  const answered = results.length;

  // Wiederholte Übertragung (z. B. nach Verbindungsabbruch) -> idempotent
  if (results.some((r) => r.item_id === item.id)) return json({ ok: true, duplicate: true, answered, main_done: answered >= TOTAL });
  if (p.completed_at) throw new HttpError(409, 'already_completed', { answered });
  // Feste Reihenfolge: keine Fragen überspringen
  if (item.position !== answered + 1) throw new HttpError(409, 'out_of_order', { expected: answered + 1 });

  const value = String(b.value ?? '');
  const valid = item.type === 'comprehension' ? ['A', 'B', 'C', 'D'].includes(value) : /^[1-5]$/.test(value);
  if (!valid) throw new HttpError(400, 'invalid_value');
  const rt = clampInt(b.rt_ms, 0, 3_600_000);
  if (rt === null) throw new HttpError(400, 'invalid_rt');

  const now = nowIso();
  const isLast = item.position === TOTAL;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO responses (participant_id, item_id, position, block, value, rt_ms, first_click_ms, hidden_ms, changes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      p.id, item.id, item.position, item.block, value, rt,
      clampInt(b.first_click_ms, 0, 3_600_000), clampInt(b.hidden_ms, 0, 86_400_000) ?? 0, clampInt(b.changes, 0, 1000) ?? 0, now,
    ),
    env.DB.prepare('UPDATE participants SET last_seen_at = ?, main_completed_at = CASE WHEN ? = 1 THEN ? ELSE main_completed_at END WHERE id = ?')
      .bind(now, isLast ? 1 : 0, now, p.id),
  ]);
  return json({ ok: true, answered: answered + 1, main_done: isLast });
}

// Manipulationschecks / Kontrollfragen eines Abschnitts (alle sichtbaren Items der Gruppe gemeinsam)
async function postExtras(request, env) {
  const p = await getParticipant(request, env);
  const b = await readJson(request);
  if (!SECTIONS.includes(b.section)) throw new HttpError(400, 'invalid_section');
  if (!p.main_completed_at) throw new HttpError(409, 'main_not_done');
  if (p.completed_at) return json({ ok: true, duplicate: true });
  const s = await getSettings(env);
  const items = visibleExtras(s, p.grp).filter((e) => e.section === b.section);
  const given = isObj(b.answers) ? b.answers : {};
  const { results: stored } = await env.DB.prepare('SELECT item_id, value FROM extra_answers WHERE participant_id = ?').bind(p.id).all();
  const known = { ...Object.fromEntries(stored.map((r) => [r.item_id, r.value])), ...Object.fromEntries(Object.entries(given).map(([k, v]) => [k, String(v ?? '').trim()])) };
  const rows = [];
  for (const e of items) {
    if (!extraApplies(e, known)) continue; // Bedingung nicht erfüllt: nicht gefragt, keine Zeile
    const raw = given[e.id] === undefined || given[e.id] === null ? '' : String(given[e.id]).trim();
    if (raw === '') {
      if (e.required) throw new HttpError(400, 'required_missing', { item: e.id });
      rows.push([e.id, '']);
      continue;
    }
    if (e.kind === 'choice' && e.multi) {
      // Mehrfachauswahl: Positionen der gewählten Optionen, eindeutig, aufsteigend, mit "|" verbunden (z. B. "1|3")
      const parts = [...new Set(raw.split('|').map((x) => x.trim()))];
      const nums = parts.map(Number).sort((a, b) => a - b);
      if (!parts.every((x) => /^\d+$/.test(x)) || nums.some((x) => x < 1 || x > e.de.options.length)) throw new HttpError(400, 'invalid_value', { item: e.id });
      rows.push([e.id, nums.join('|')]);
      continue;
    }
    const n = Number(raw);
    const ok = e.kind === 'number'
      ? /^-?\d+$/.test(raw) && n >= e.min && n <= e.max
      : /^\d+$/.test(raw) && n >= 1 && n <= e.de.options.length;
    if (!ok) throw new HttpError(400, 'invalid_value', { item: e.id });
    rows.push([e.id, String(n)]);
  }
  const now = nowIso();
  const stmts = rows.map(([id, v]) =>
    env.DB.prepare('INSERT OR IGNORE INTO extra_answers (participant_id, item_id, value) VALUES (?, ?, ?)').bind(p.id, id, v));
  stmts.push(env.DB.prepare('UPDATE participants SET last_seen_at = ? WHERE id = ?').bind(now, p.id));
  await env.DB.batch(stmts);
  return json({ ok: true });
}

// Abschluss: Der Code wird vom Gerät erzeugt und OHNE Personenbezug gespeichert (nur mit Datum).
async function postFinish(request, env) {
  const p = await getParticipant(request, env);
  const b = await readJson(request);
  if (!p.main_completed_at) throw new HttpError(409, 'main_not_done');
  if (p.completed_at) return json({ ok: true, completed: true, duplicate: true });
  if (typeof b.code !== 'string' || !CODE_RE.test(b.code)) throw new HttpError(400, 'invalid_code');
  const s = await getSettings(env);
  const st = await extrasState(env, p, s);
  const open = SECTIONS.find((sec) => !st.sections[sec].done);
  if (open) throw new HttpError(409, 'extras_missing', { section: open });
  const now = nowIso();
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO prize_codes (code, day, is_test) VALUES (?, ?, ?)').bind(b.code, now.slice(0, 10), p.is_test),
      env.DB.prepare('UPDATE participants SET completed_at = ?, last_seen_at = ? WHERE id = ? AND completed_at IS NULL').bind(now, now, p.id),
    ]);
  } catch (e) {
    if (/UNIQUE|constraint/i.test(String(e.message))) throw new HttpError(409, 'code_taken');
    throw e;
  }
  return json({ ok: true, completed: true });
}

async function postEvents(request, env) {
  const p = await getParticipant(request, env);
  const b = await readJson(request, 65536);
  const events = (Array.isArray(b.events) ? b.events : []).slice(0, 100).filter((e) => isObj(e) && EVENT_TYPES.has(e.type));
  const stmts = events.map((e) =>
    env.DB.prepare('INSERT INTO events (participant_id, type, item_id, client_ts, data) VALUES (?, ?, ?, ?, ?)').bind(
      p.id, e.type, ITEM_BY_ID[e.item_id] ? e.item_id : null, clampInt(e.t, 0, 1e13),
      e.data == null ? null : JSON.stringify(e.data).slice(0, 500),
    ),
  );
  stmts.push(env.DB.prepare('UPDATE participants SET last_seen_at = ? WHERE id = ?').bind(nowIso(), p.id));
  await env.DB.batch(stmts);
  return json({ ok: true, stored: events.length });
}

// ---------------------------------------------------------------- Auswertung
// Rohdaten (participants, responses, extra_answers, events) sind das Original. Alle Indikatoren werden hier daraus neu berechnet.

// Wortzahl für die Speeding-Schwelle: nur Text (alt) oder inklusive Antwortoptionen (Pflichtenheft, Standard)
const wordsFor = (it, lang, s) => (s.word_count_mode === 'text' ? it.words : it.words_opt)[lang];
const iso = (ms) => (Number.isFinite(Number(ms)) && ms !== null ? new Date(Number(ms)).toISOString() : null);
const quantile = (xs, p) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const i = (a.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(a[lo] + (a[hi] - a[lo]) * (i - lo));
};
const catCache = new WeakMap();
const catalogOf = (s) => {
  if (!catCache.has(s)) catCache.set(s, effectiveItems(s.catalog_overrides));
  return catCache.get(s);
};
const deviceClass = (p) => (p.device_mobile === 1 ? 'mobile' : p.device_mobile === 0 ? 'desktop' : null);
const PREFIX = { manipulation: 'mc', control: 'cv', feedback: 'fb' };
const ROLE_OF = { Q06: 'consistency_a', Q10: 'consistency_b', Q09: 'comprehension', Q14: 'bogus' };

function evaluate(p, rs, s) {
  const factor = Number(s.speeding_factor?.[p.lang]) || 0.3;
  const cat = Object.fromEntries(catalogOf(s).map((it) => [it.id, it]));
  const by = {};
  let sc = 0, sn = 0, hidden = 0;
  const items = rs.map((r) => {
    const it = cat[r.item_id];
    by[r.item_id] = r.value;
    hidden += r.hidden_ms || 0;
    const words = it ? wordsFor(it, p.lang, s) : null;
    let threshold = null, speeding = null;
    if (it?.speeding) {
      threshold = Math.round(factor * words * 1000);
      speeding = r.rt_ms < threshold ? 1 : 0;
      sc += speeding;
      sn++;
    }
    return { ...r, item_type: it?.type ?? null, words, speeding_threshold_ms: threshold, speeding };
  });
  // Auffällig = 1, unauffällig = 0, fehlend = NA (nie automatisch 0)
  const wrong = (id) => (by[id] == null ? null : ITEM_BY_ID[id].correct.includes(by[id]) ? 0 : 1);
  let consistency = null;
  const a = by[ROLES.consistencyA], bb = by[ROLES.consistencyB];
  if (a != null && bb != null) {
    const x = Number(a), y = Number(bb);
    consistency = s.consistency?.rule === 'diff'
      ? (Math.abs(x - (6 - y)) >= (s.consistency.min_diff || 3) ? 1 : 0) // Q6 vs. invertierte Q10
      : ((x >= 4 && y >= 4) || (x <= 2 && y <= 2) ? 1 : 0); // beiden Aussagen zugestimmt bzw. beide abgelehnt
  }
  return {
    items,
    person: {
      n_answered: rs.length,
      speeding_items: sn,
      speeding_count: sc,
      speeding_share: sn ? Number((sc / sn).toFixed(4)) : null,
      bogus: wrong(ROLES.bogus),
      consistency,
      comprehension: wrong(ROLES.comprehension),
      q06: by[ROLES.consistencyA] ?? null,
      q10: by[ROLES.consistencyB] ?? null,
      q10_inverted: by[ROLES.consistencyB] != null ? 6 - Number(by[ROLES.consistencyB]) : null,
      q09: by[ROLES.comprehension] ?? null,
      q14: by[ROLES.bogus] ?? null,
      total_hidden_ms: hidden,
    },
  };
}

// ---- Filter: Gruppe, Sprache, Version, Modus (prod/test/all), Status, Zeitraum
function parseFilters(url) {
  const q = url.searchParams;
  const block = Number(q.get('block'));
  const date = (k) => (/^\d{4}-\d{2}-\d{2}$/.test(q.get(k) || '') ? q.get(k) : null);
  return {
    group: GROUPS.includes(q.get('group')) ? q.get('group') : null,
    lang: LANGS.includes(q.get('lang')) ? q.get('lang') : null,
    version: q.get('version') || null,
    mode: ['prod', 'test', 'all'].includes(q.get('mode')) ? q.get('mode') : q.get('include_test') === '1' ? 'all' : 'prod',
    status: q.get('completed_only') === '1' ? 'completed' : ['completed', 'abandoned', 'in_progress'].includes(q.get('status')) ? q.get('status') : null,
    from: date('from'),
    to: date('to'),
    block: [1, 2, 3].includes(block) ? block : null,
    item: ITEM_BY_ID[q.get('item')] ? q.get('item') : null,
  };
}

function whereClause(f, s) {
  const w = [], binds = [];
  if (f.mode === 'prod') w.push('p.is_test = 0');
  else if (f.mode === 'test') w.push('p.is_test = 1');
  if (f.group) { w.push('p.grp = ?'); binds.push(f.group); }
  if (f.lang) { w.push('p.lang = ?'); binds.push(f.lang); }
  if (f.version) { w.push('p.version = ?'); binds.push(f.version); }
  if (f.from) { w.push('p.created_at >= ?'); binds.push(`${f.from}T00:00:00.000Z`); }
  if (f.to) { w.push('p.created_at <= ?'); binds.push(`${f.to}T23:59:59.999Z`); }
  if (f.status) {
    const cutoff = new Date(Date.now() - s.abandon_after_min * 60000).toISOString();
    if (f.status === 'completed') w.push('p.completed_at IS NOT NULL');
    else if (f.status === 'abandoned') { w.push('(p.completed_at IS NULL AND COALESCE(p.last_seen_at, p.created_at) < ?)'); binds.push(cutoff); }
    else { w.push('(p.completed_at IS NULL AND COALESCE(p.last_seen_at, p.created_at) >= ?)'); binds.push(cutoff); }
  }
  return { sql: w.length ? `WHERE ${w.join(' AND ')}` : '', binds };
}

async function loadData(env, f, s) {
  const { sql, binds } = whereClause(f, s);
  const [ps, rs] = await env.DB.batch([
    env.DB.prepare(`SELECT p.* FROM participants p ${sql} ORDER BY p.created_at`).bind(...binds),
    env.DB.prepare(`SELECT r.* FROM responses r JOIN participants p ON p.id = r.participant_id ${sql} ORDER BY r.participant_id, r.position`).bind(...binds),
  ]);
  const responsesBy = new Map();
  for (const r of rs.results) {
    if (!responsesBy.has(r.participant_id)) responsesBy.set(r.participant_id, []);
    responsesBy.get(r.participant_id).push(r);
  }
  return { participants: ps.results, responsesBy };
}

async function loadExtraAnswers(env, f, s) {
  const { sql, binds } = whereClause(f, s);
  const { results } = await env.DB.prepare(
    `SELECT e.participant_id, e.item_id, e.value, e.created_at, p.grp FROM extra_answers e JOIN participants p ON p.id = e.participant_id ${sql} ORDER BY e.participant_id, e.created_at`,
  ).bind(...binds).all();
  return results;
}

async function loadEvents(env, f, s, types) {
  const { sql, binds } = whereClause(f, s);
  const cond = types ? `${sql ? `${sql} AND` : 'WHERE'} e.type IN (${types.map(() => '?').join(',')})` : sql;
  const { results } = await env.DB.prepare(
    `SELECT e.id, e.participant_id, e.type, e.item_id, e.client_ts, e.data, e.created_at, p.grp, p.lang, p.version, p.is_test
     FROM events e JOIN participants p ON p.id = e.participant_id ${cond} ORDER BY e.id`,
  ).bind(...binds, ...(types || [])).all();
  return results;
}

const statusOf = (p, s, now = Date.now()) =>
  p.completed_at ? 'completed'
    : now - Date.parse(p.last_seen_at || p.created_at) > s.abandon_after_min * 60000 ? 'abandoned' : 'in_progress';

// ---- Dokumentierte Kennzahlen: Definition, Nenner, passende Exportspalte
const KPI_DEFS = [
  { id: 'started', name: 'Starts / gültige Einwilligungen', definition: 'Teilnahmen mit erteilter Einwilligung (Sitzung angelegt, Gruppe zugeteilt).', denominator: '–', export: 'participants.csv: eine Zeile je Teilnahme (consent_at)' },
  { id: 'completed', name: 'Vollständige Abschlüsse', definition: 'completed_at gesetzt: 15 Hauptfragen, alle sichtbaren Pflichtseiten und Abschluss.', denominator: 'Starts', export: 'participants.csv: status = completed' },
  { id: 'abandoned', name: 'Abbrüche', definition: 'Nicht abgeschlossen und länger als die eingestellte Inaktivitätszeit ohne Aktivität.', denominator: 'Starts', export: 'participants.csv: status = abandoned' },
  { id: 'in_progress', name: 'Laufend', definition: 'Nicht abgeschlossen, aber innerhalb der Inaktivitätszeit noch aktiv.', denominator: 'Starts', export: 'participants.csv: status = in_progress' },
  { id: 'completion_rate', name: 'Abschlussquote', definition: 'Abschlüsse ÷ Starts.', denominator: 'Starts', export: 'participants.csv: status' },
  { id: 'randomization', name: 'Randomisierung (Anteil je Gruppe)', definition: 'Starts je Gruppe ÷ Starts gesamt; Zuteilung serverseitig ausgeglichen (1:1:1) je Version und Test/Produktiv.', denominator: 'Starts gesamt', export: 'participants.csv: group' },
  { id: 'median_rt', name: 'Median Antwortzeit (ms)', definition: 'performance.now() ab vollständig sichtbarer Frage bis Abgabe; Ladezeit, Animation und Hinweisseiten zählen nicht. Median über alle beantworteten Speeding-Items.', denominator: 'beantwortete Speeding-Items', export: 'responses_long.csv: duration_ms' },
  { id: 'rt_per_item', name: 'Antwortzeit je Frage (Median, Q1–Q3)', definition: 'Verteilung der Antwortdauer je Frage und Gruppe.', denominator: 'beantwortete Fälle je Frage × Gruppe', export: 'responses_long.csv: question_id, group, duration_ms' },
  { id: 'speeding', name: 'Speeding-Quote', definition: 'Anteil speeding_flag = 1 an gültigen Speeding-Items (13 Items, ohne Q9/Q14). Flag = 1, falls duration_ms < Wortanzahl × Faktor (s/Wort, je Sprache).', denominator: 'gültig beantwortete Speeding-Items (n_speeding_valid)', export: 'responses_long.csv: speeding_flag; derived_person.csv: n_speeding, n_speeding_valid, speeding_share' },
  { id: 'bogus', name: 'Bogus-Item (Q14)', definition: 'Auffällig (1), wenn die Antwort nicht 4 oder 5 ist; fehlend = NA.', denominator: 'Personen mit Antwort auf Q14', export: 'derived_person.csv: bogus_flag' },
  { id: 'consistency', name: 'Consistency (Q6/Q10)', definition: 'Q10 invertiert (6 − Q10) und mit Q6 verglichen; Regel und Schwelle laut Konfiguration; fehlend = NA.', denominator: 'Personen mit Antwort auf Q6 und Q10', export: 'derived_person.csv: consistency_flag, q06, q10, q10_inverted' },
  { id: 'comprehension', name: 'Comprehension (Q9)', definition: 'Auffällig (1), wenn die Antwort nicht korrekt ist (A); fehlend = NA.', denominator: 'Personen mit Antwort auf Q9', export: 'derived_person.csv: comprehension_flag, q09_choice' },
  { id: 'reach', name: 'Fortschritt / Abbruchstelle', definition: 'Personen mit mindestens k beantworteten Hauptfragen.', denominator: 'Starts', export: 'responses_long.csv: answered; derived_person.csv: n_answered' },
  { id: 'manipulation', name: 'Manipulationscheck', definition: 'Einfachauswahl: 1 = Gamification-Aussage (virtuelle Reise, akademische Laufbahn), 2 = Motivations-Aussage (ermutigende Worte), 3 = neutral. Ausgewertet wird der Anteil je Antwort und Gruppe; erwartet wird die höchste Quote bei der eigenen Bedingung. Kein Nachweis kausaler Wirkung.', denominator: 'beantwortete Checks je Gruppe (n)', export: 'checks_and_covariates.csv: check_type = manipulation' },
  { id: 'control', name: 'Kontextvariablen', definition: 'Verteilung je Gruppe (z. B. Semester, Umfrageerfahrung, Teilnahmegrund); Fehlwerte werden getrennt gezählt.', denominator: 'beantwortete Items je Gruppe (n) und Fehlwerte (NA)', export: 'checks_and_covariates.csv: check_type = control' },
  { id: 'feedback', name: 'Zufriedenheit (Smiley)', definition: 'Mittelwert der Bewertung 1 (gar nicht gut) bis 5 (sehr gut). Bei 1–2 folgt F2 (was nicht gefallen hat), bei 4–5 folgt F3 (was besonders gefallen hat), bei 3 keine Nachfrage; nicht gestellte Nachfragen sind NA.', denominator: 'beantwortete Bewertungen je Gruppe (n)', export: 'checks_and_covariates.csv: check_type = feedback' },
  { id: 'quality', name: 'Datenqualität', definition: 'Fehlende Hauptantworten, technische Speicherfehler (save_error), Wiederholungs-Verdacht (Browser hatte schon einen Abschluss), Geräteklasse, Sprache.', denominator: 'Starts bzw. erwartete Antworten (Starts × 15)', export: 'participants.csv: device_class, language; events.csv: event_type = save_error / consent' },
];

async function adminStats(env, url) {
  const s = await getSettings(env);
  const f = parseFilters(url);
  const { participants, responsesBy } = await loadData(env, f, s);
  const mk = () => ({
    started: 0, completed: 0, in_progress: 0, abandoned: 0, main_completed: 0,
    speeding: [0, 0], bogus: [0, 0], consistency: [0, 0], comprehension: [0, 0],
    blocks: [[0, 0], [0, 0], [0, 0]], durations: [], rts: [], reach: Array(TOTAL + 1).fill(0),
    mobile: 0, desktop: 0, device_unknown: 0, items_answered: 0,
  });
  const total = mk();
  const groups = Object.fromEntries(GROUPS.map((g) => [g, mk()]));
  const langs = { de: 0, en: 0 };
  const perItem = {};
  const now = Date.now();
  for (const p of participants) {
    const { person, items } = evaluate(p, responsesBy.get(p.id) || [], s);
    const st = statusOf(p, s, now);
    langs[p.lang]++;
    for (const a of [total, groups[p.grp]]) {
      a.started++;
      a[st]++;
      if (p.main_completed_at) a.main_completed++;
      if (p.completed_at) a.durations.push((Date.parse(p.completed_at) - Date.parse(p.created_at)) / 1000);
      a.items_answered += person.n_answered;
      for (let k = 0; k <= Math.min(person.n_answered, TOTAL); k++) a.reach[k]++;
      if (p.device_mobile === 1) a.mobile++; else if (p.device_mobile === 0) a.desktop++; else a.device_unknown++;
      for (const it of items) {
        if (it.speeding === null) continue;
        a.rts.push(it.rt_ms);
        a.speeding[0] += it.speeding; a.speeding[1]++;
        a.blocks[it.block - 1][0] += it.speeding; a.blocks[it.block - 1][1]++;
      }
      for (const k of ['bogus', 'consistency', 'comprehension']) {
        if (person[k] !== null) { a[k][0] += person[k]; a[k][1]++; }
      }
    }
    for (const it of items) {
      const x = ((perItem[it.item_id] ??= {})[p.grp] ??= { rts: [], sp: [0, 0] });
      x.rts.push(it.rt_ms);
      if (it.speeding !== null) { x.sp[0] += it.speeding; x.sp[1]++; }
    }
  }
  const fin = ({ durations, rts, ...a }) => ({ ...a, median_duration_s: median(durations), median_rt_ms: median(rts) });

  // Manipulationschecks / Kontext / Zufriedenheit je Gruppe (inkl. Fehlwerte)
  const extras = {};
  const multiIds = new Set(s.extras.filter((e) => e.multi).map((e) => e.id));
  for (const r of await loadExtraAnswers(env, f, s)) {
    const g = ((extras[r.item_id] ??= {})[r.grp] ??= { n: 0, na: 0, sum: 0, dist: {} });
    if (r.value === '') { g.na++; continue; }
    g.n++;
    if (!multiIds.has(r.item_id)) g.sum += Number(r.value);
    for (const part of multiIds.has(r.item_id) ? r.value.split('|') : [r.value]) g.dist[part] = (g.dist[part] || 0) + 1;
  }
  for (const e of Object.values(extras)) for (const g of Object.values(e)) { g.mean = g.n && g.sum ? Number((g.sum / g.n).toFixed(2)) : null; delete g.sum; }

  // Datenqualität: technische Fehler, Wiederholungs-Verdacht
  let saveErrors = 0, repeats = 0;
  const errPeople = new Set();
  for (const e of await loadEvents(env, f, s, ['save_error', 'consent'])) {
    if (e.type === 'save_error') { saveErrors++; errPeople.add(e.participant_id); } else {
      try { if (JSON.parse(e.data || '{}').repeat) repeats++; } catch { /* ignorieren */ }
    }
  }

  const { results: versions } = await env.DB.prepare(
    'SELECT version, COUNT(*) AS n FROM participants GROUP BY version ORDER BY MIN(created_at)',
  ).bind().all();
  const snap = await env.DB.prepare('SELECT catalog_hash FROM config_versions WHERE version = ?').bind(s.experiment_version).first();
  const items = catalogOf(s).map((it) => ({
    id: it.id, position: it.position, block: it.block, type: it.type, speeding: it.speeding,
    groups: Object.fromEntries(GROUPS.map((g) => {
      const x = perItem[it.id]?.[g];
      return [g, x
        ? { n: x.rts.length, median_ms: median(x.rts), q1_ms: quantile(x.rts, 0.25), q3_ms: quantile(x.rts, 0.75), speeding: x.sp }
        : { n: 0, median_ms: null, q1_ms: null, q3_ms: null, speeding: [0, 0] }];
    })),
  }));
  return json({
    generated_at: nowIso(),
    current_version: s.experiment_version,
    catalog_mismatch: !!snap && snap.catalog_hash !== (await sha256(CATALOG_HASH_SRC)),
    filters: f,
    rules: { word_count_mode: s.word_count_mode, speeding_factor: s.speeding_factor, consistency: s.consistency, abandon_after_min: s.abandon_after_min },
    total: fin(total),
    groups: Object.fromEntries(GROUPS.map((g) => [g, fin(groups[g])])),
    langs,
    versions,
    extras,
    extras_meta: s.extras.map((e) => ({ id: e.id, section: e.section, kind: e.kind, ordinal: e.ordinal, multi: !!e.multi, text: e.de.text, options: e.de.options })),
    items,
    quality: {
      save_errors: saveErrors,
      participants_with_errors: errPeople.size,
      repeat_suspects: repeats,
      items_expected: total.started * TOTAL,
      items_answered: total.items_answered,
    },
    definitions: KPI_DEFS,
  });
}

// ---------------------------------------------------------------- Export (CSV UTF-8, ISO-8601, NA für fehlende Werte)

function toCSV(cols, rows, sep = ',', bom = false) {
  const cell = (v) => {
    if (v === null || v === undefined || v === '') return 'NA';
    if (typeof v === 'boolean') return v ? '1' : '0';
    let t = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t) && !/^-?\d/.test(t)) t = `'${t}`; // Formel-Injection verhindern
    return /["\n\r,;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return (bom ? '﻿' : '') + [cols.join(sep), ...rows.map((r) => cols.map((c) => cell(r[c])).join(sep))].join('\r\n') + '\r\n';
}

const csvResponse = (name, body) =>
  new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}_${nowIso().slice(0, 16).replace(/[:T]/g, '-')}.csv"`,
      'cache-control': 'no-store',
    },
  });

const EXPORT_LEVELS = ['participants', 'responses_long', 'codebook', 'checks', 'derived', 'events', 'config'];
const LEVEL_ALIAS = { person: 'derived', item: 'responses_long' };
const FILE_NAME = { participants: 'participants', responses_long: 'responses_long', codebook: 'questions_codebook', checks: 'checks_and_covariates', derived: 'derived_person', events: 'events', config: 'experiment_config' };

const metaOfExtras = (s) => Object.fromEntries(s.extras.map((e) => [e.id, e]));

// participants.csv – eine Zeile je Teilnahme
function buildParticipants(ctx, profile) {
  const raw = profile === 'raw';
  const cols = ['participant_id', 'group', 'consent_at', 'started_at', ...(raw ? ['last_seen_at'] : []), 'main_completed_at', 'completed_at', 'status',
    'language', 'device_class', 'experiment_version', 'randomization_version', 'is_test', 'n_answered',
    ...(raw ? ['source'] : [])];
  const rows = ctx.participants.map((p) => ({
    participant_id: p.id, group: p.grp, consent_at: p.consent_at, started_at: p.created_at, last_seen_at: p.last_seen_at,
    main_completed_at: p.main_completed_at, completed_at: p.completed_at, status: statusOf(p, ctx.s, ctx.now),
    language: p.lang, device_class: deviceClass(p), experiment_version: p.version, randomization_version: p.version,
    is_test: p.is_test, n_answered: (ctx.responsesBy.get(p.id) || []).length,
    source: p.source,
  }));
  return { cols, rows };
}

// responses_long.csv – eine Zeile je Person × Hauptfrage (auch unbeantwortete: answered = 0, Werte = NA)
function buildResponses(ctx) {
  const cols = ['participant_id', 'group', 'question_id', 'item_order', 'block', 'item_type', 'response_value', 'answered', 'correct',
    'shown_at', 'submitted_at', 'duration_ms', 'first_click_ms', 'hidden_ms', 'changes', 'word_count', 'speeding_threshold_ms',
    'speeding_flag', 'language', 'experiment_version', 'is_test'];
  const rows = [];
  for (const p of ctx.participants) {
    const rs = ctx.responsesBy.get(p.id) || [];
    const byItem = Object.fromEntries(rs.map((r) => [r.item_id, r]));
    const ev = Object.fromEntries(evaluate(p, rs, ctx.s).items.map((e) => [e.item_id, e]));
    const factor = Number(ctx.s.speeding_factor?.[p.lang]) || 0.3;
    for (const it of ctx.catalog) {
      if ((ctx.f.block && it.block !== ctx.f.block) || (ctx.f.item && it.id !== ctx.f.item)) continue;
      const r = byItem[it.id];
      const words = wordsFor(it, p.lang, ctx.s);
      rows.push({
        participant_id: p.id, group: p.grp, question_id: it.id, item_order: it.position, block: it.block, item_type: it.type,
        response_value: r ? r.value : null, answered: r ? 1 : 0,
        correct: r && it.correct ? (it.correct.includes(r.value) ? 1 : 0) : null,
        shown_at: iso(ctx.shownMain.get(`${p.id}|${it.id}`) ?? null), submitted_at: r ? r.created_at : null,
        duration_ms: r ? r.rt_ms : null, first_click_ms: r ? r.first_click_ms : null, hidden_ms: r ? r.hidden_ms : null, changes: r ? r.changes : null,
        word_count: words, speeding_threshold_ms: it.speeding ? Math.round(factor * words * 1000) : null,
        speeding_flag: ev[it.id] ? ev[it.id].speeding : null,
        language: p.lang, experiment_version: p.version, is_test: p.is_test,
      });
    }
  }
  return { cols, rows };
}

// questions_codebook.csv – Itemdefinitionen (Haupt- und Zusatzfragen)
function buildCodebook(ctx) {
  const { s } = ctx;
  const opts = (a) => (a || []).join(' | ');
  const cols = ['question_id', 'question_kind', 'item_type', 'block', 'item_order', 'passage_de', 'passage_en', 'question_text_de', 'question_text_en',
    'options_de', 'options_en', 'coding', 'is_speeding_item', 'word_count_text_de', 'word_count_text_en', 'word_count_with_options_de',
    'word_count_with_options_en', 'word_count_used_de', 'word_count_used_en', 'check_role', 'required', 'visible', 'groups', 'version'];
  const rows = ctx.catalog.map((it) => {
    const o = it.de.options;
    const coding = it.type === 'comprehension'
      ? 'Antwortbuchstabe A–D; korrekt = A; flag 1 = falsch'
      : it.type === 'bogus'
        ? 'Skala 1–5; unauffällig (0) = 4 oder 5, sonst 1'
        : `Skala 1–5 (1 = ${o[0]} … 5 = ${o[4]})${ROLE_OF[it.id]?.startsWith('consistency') ? '; für Konsistenz wird Q10 invertiert (6 − Q10)' : ''}`;
    return {
      question_id: it.id, question_kind: 'main', item_type: it.type, block: it.block, item_order: it.position,
      passage_de: it.de.passage || null, passage_en: it.en.passage || null, question_text_de: it.de.text, question_text_en: it.en.text,
      options_de: opts(it.de.options), options_en: opts(it.en.options), coding, is_speeding_item: it.speeding ? 1 : 0,
      word_count_text_de: it.words.de, word_count_text_en: it.words.en, word_count_with_options_de: it.words_opt.de, word_count_with_options_en: it.words_opt.en,
      word_count_used_de: wordsFor(it, 'de', s), word_count_used_en: wordsFor(it, 'en', s),
      check_role: ROLE_OF[it.id] || 'none', required: 1, visible: 1, groups: GROUPS.join('|'), version: s.experiment_version,
    };
  });
  s.extras.forEach((e, i) => {
    rows.push({
      question_id: e.id, question_kind: e.section, item_type: e.kind, block: null, item_order: TOTAL + 1 + i,
      passage_de: null, passage_en: null, question_text_de: e.de.text, question_text_en: e.en.text,
      options_de: opts(e.de.options), options_en: opts(e.en.options),
      coding: e.kind === 'number' ? `ganze Zahl ${e.min}–${e.max}` : e.multi ? `Mehrfachauswahl aus ${e.de.options.length} Optionen; Wert = Positionen der gewählten Optionen, mit | getrennt (z. B. 1|3); NA = nicht beantwortet oder nicht gefragt` : `${e.de.options.length} Optionen; Wert = Position der Option (1 = erste)`,
      is_speeding_item: 0, check_role: e.section, required: e.required ? 1 : 0, visible: e.visible ? 1 : 0, groups: e.groups.join('|'), version: s.experiment_version,
    });
  });
  return { cols, rows };
}

// checks_and_covariates.csv – eine Zeile je Zusatzantwort (Manipulationscheck / Kontrollfrage / Zufriedenheit)
function buildChecks(ctx) {
  const meta = metaOfExtras(ctx.s);
  const cols = ['participant_id', 'group', 'check_id', 'check_type', 'response_value', 'answered', 'shown_at', 'submitted_at', 'language', 'experiment_version', 'is_test'];
  const rows = ctx.extraRows.map((r) => {
    const p = ctx.pById.get(r.participant_id);
    const type = meta[r.item_id]?.section ?? null;
    return {
      participant_id: r.participant_id, group: r.grp, check_id: r.item_id, check_type: type,
      response_value: r.value === '' ? null : r.value, answered: r.value === '' ? 0 : 1,
      shown_at: type ? ctx.shownExtras.get(`${r.participant_id}|${type}`) ?? null : null, submitted_at: r.created_at,
      language: p?.lang ?? null, experiment_version: p?.version ?? null, is_test: p?.is_test ?? null,
    };
  });
  return { cols, rows };
}

// derived_person.csv – eine Zeile je Person, aus den Rohdaten neu berechnet
function buildDerived(ctx) {
  const meta = metaOfExtras(ctx.s);
  const colOf = (id) => `${PREFIX[meta[id]?.section] || 'x'}_${id}`;
  const ids = [...new Set([...ctx.s.extras.map((e) => e.id), ...ctx.extraRows.map((r) => r.item_id)])];
  const covCols = ids.map(colOf);
  const cov = new Map();
  for (const r of ctx.extraRows) {
    if (!cov.has(r.participant_id)) cov.set(r.participant_id, {});
    cov.get(r.participant_id)[colOf(r.item_id)] = r.value === '' ? null : r.value;
  }
  const cols = ['participant_id', 'group', 'status', 'completed', 'language', 'device_class', 'experiment_version', 'is_test', 'n_answered',
    'n_speeding', 'n_speeding_valid', 'speeding_share', 'bogus_flag', 'consistency_flag', 'comprehension_flag', 'q06', 'q10', 'q10_inverted',
    'q09_choice', 'q14_value', 'duration_s', ...covCols];
  const rows = ctx.participants.map((p) => {
    const { person } = evaluate(p, ctx.responsesBy.get(p.id) || [], ctx.s);
    return {
      participant_id: p.id, group: p.grp, status: statusOf(p, ctx.s, ctx.now), completed: p.completed_at ? 1 : 0, language: p.lang,
      device_class: deviceClass(p), experiment_version: p.version, is_test: p.is_test, n_answered: person.n_answered,
      n_speeding: person.speeding_items ? person.speeding_count : null, n_speeding_valid: person.speeding_items, speeding_share: person.speeding_share,
      bogus_flag: person.bogus, consistency_flag: person.consistency, comprehension_flag: person.comprehension,
      q06: person.q06, q10: person.q10, q10_inverted: person.q10_inverted, q09_choice: person.q09, q14_value: person.q14,
      duration_s: p.completed_at ? Math.round((Date.parse(p.completed_at) - Date.parse(p.created_at)) / 1000) : null,
      ...(cov.get(p.id) || {}),
    };
  });
  return { cols, rows };
}

// events.csv – nur notwendige Ablaufereignisse (keine Mausbewegungen); analysis-Profil ohne Rohdatenfeld
function buildEvents(ctx, profile) {
  const raw = profile === 'raw';
  const cols = ['participant_id', 'group', 'language', 'experiment_version', 'is_test', 'event_id', 'event_type', 'question_id', 'treatment_stage', 'client_time', 'server_time', ...(raw ? ['data'] : [])];
  const rows = ctx.events.map((e) => ({
    participant_id: e.participant_id, group: e.grp, language: e.lang, experiment_version: e.version, is_test: e.is_test, event_id: e.id,
    event_type: e.type, question_id: e.item_id, treatment_stage: e.item_id ? ctx.catalogById[e.item_id]?.block ?? null : null,
    client_time: iso(e.client_ts), server_time: e.created_at, data: e.data,
  }));
  return { cols, rows };
}

// experiment_config.json – archivierte Studienkonfiguration inkl. Versionsstände und Kennzahl-Definitionen
async function exportConfig(env, s, profile) {
  const cat = catalogOf(s);
  const { results: versions } = await env.DB.prepare(
    `SELECT v.version, v.frozen_at, v.catalog_hash,
       (SELECT COUNT(*) FROM participants p WHERE p.version = v.version AND p.is_test = 0) AS participants
     FROM config_versions v ORDER BY v.frozen_at`,
  ).bind().all();
  const body = {
    exported_at: nowIso(),
    export_profile: profile,
    experiment_version: s.experiment_version,
    note: 'Rohdaten sind das Original; alle Indikatoren sind daraus mit diesen Regeln neu berechenbar. Zeitstempel ISO-8601 (UTC). shown_at der Hauptfragen stammt aus der Uhr des Geräts, submitted_at vom Server.',
    groups: [
      { id: 'control', name_de: 'Kontrolle', treatment: 'Neutraler Kopfbereich ab Q1; keine spielerischen oder motivierenden Hinweise.' },
      { id: 'gamification', name_de: 'Gamification', treatment: 'Animierte Fortschrittsreise ab Q1 auf jeder Frageseite (Wald → Stadt mit Universität → Raketenstation → antikes Forum); Titel (Student, Bachelor, Master, Professor) nur aus der Zahl beantworteter Fragen; Punktanzeige standardmäßig aus.', journey: s.journey },
      { id: 'motivation', name: 'Motivation', treatment: 'Einmalige Hinweisseiten vor Q1 sowie nach Q5 und Q10; keine Botschaft auf Frageseiten.', interstitials: [{ before_question: 1 }, { after_question: 5 }, { after_question: 10 }], texts: s.motivation },
    ],
    randomization: { method: 'serverseitig; neue Person kommt in die Gruppe mit den wenigsten Teilnahmen der Version (Gleichstand zufällig), getrennt nach Test/Produktiv', stable_per_session: true },
    flow: { main_items: TOTAL, order: cat.map((i) => i.id), blocks: { 1: 'Q01–Q05', 2: 'Q06–Q10', 3: 'Q11–Q15' }, after_main: SECTIONS },
    scoring: {
      speeding: { items: cat.filter((i) => i.speeding).map((i) => i.id), rule: 'duration_ms < Wortanzahl × Faktor × 1000', factor_seconds_per_word: s.speeding_factor, word_count_mode: s.word_count_mode, word_count_mode_note: 'text_options = Text/Passage plus Antwortoptionen (Pflichtenheft); text = nur Text/Passage' },
      consistency: { pair: ['Q06', 'Q10'], inversion: '6 − Q10', rule: s.consistency },
      comprehension: { item: 'Q09', correct: ITEM_BY_ID.Q09.correct, flag_if: 'falsch' },
      bogus: { item: 'Q14', unauffaellig: ITEM_BY_ID.Q14.correct, flag_if: 'sonst' },
      missing: 'Fehlende Werte sind NA (nicht 0).',
      abandon_after_min: s.abandon_after_min,
    },
    items: cat.map((it) => ({ id: it.id, order: it.position, block: it.block, type: it.type, speeding: it.speeding, role: ROLE_OF[it.id] || 'none', de: it.de, en: it.en, word_count_text: it.words, word_count_with_options: it.words_opt })),
    extras: s.extras,
    versions,
    kpi_definitions: KPI_DEFS,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="experiment_config_${nowIso().slice(0, 16).replace(/[:T]/g, '-')}.json"`,
      'cache-control': 'no-store',
    },
  });
}

async function adminExport(env, url) {
  const s = await getSettings(env);
  const f = parseFilters(url);
  const asked = url.searchParams.get('level');
  const level = EXPORT_LEVELS.includes(LEVEL_ALIAS[asked] || asked) ? LEVEL_ALIAS[asked] || asked : 'participants';
  const profile = url.searchParams.get('profile') === 'analysis' ? 'analysis' : 'raw';
  const sep = url.searchParams.get('sep') === 'semicolon' ? ';' : ',';

  if (level === 'config') {
    await audit(env, 'export', { level, profile, rows: 1, filters: f });
    return exportConfig(env, s, profile);
  }

  const { participants, responsesBy } = await loadData(env, f, s);
  const catalog = catalogOf(s);
  const ctx = {
    s, f, now: Date.now(), participants, responsesBy, catalog, catalogById: Object.fromEntries(catalog.map((i) => [i.id, i])),
    pById: new Map(participants.map((p) => [p.id, p])), shownMain: new Map(), shownExtras: new Map(), extraRows: [], events: [],
  };
  if (level === 'responses_long') {
    for (const e of await loadEvents(env, f, s, ['question_visible'])) {
      const key = `${e.participant_id}|${e.item_id}`;
      if (!ctx.shownMain.has(key) && e.client_ts) ctx.shownMain.set(key, e.client_ts);
    }
  }
  if (level === 'checks' || level === 'derived') ctx.extraRows = await loadExtraAnswers(env, f, s);
  if (level === 'checks') {
    for (const e of await loadEvents(env, f, s, ['extras_shown'])) {
      let sec = null;
      try { sec = JSON.parse(e.data || '{}').section; } catch { /* ignorieren */ }
      const key = `${e.participant_id}|${sec}`;
      if (sec && !ctx.shownExtras.has(key)) ctx.shownExtras.set(key, iso(e.client_ts) ?? e.created_at);
    }
  }
  if (level === 'events') ctx.events = await loadEvents(env, f, s, null);

  const built = {
    participants: buildParticipants, responses_long: buildResponses, codebook: buildCodebook, checks: buildChecks, derived: buildDerived, events: buildEvents,
  }[level](ctx, profile);
  await audit(env, 'export', { level, profile, rows: built.rows.length, filters: f });
  // UTF-8 ohne BOM (R/Python/Stata); BOM nur zusammen mit Semikolon (Excel DE)
  return csvResponse(`${FILE_NAME[level]}${profile === 'analysis' ? '_analysis' : ''}`, toCSV(built.cols, built.rows, sep, sep === ';'));
}

// ---------------------------------------------------------------- Admin: Gewinnspiel (getrennt von den Antworten)

async function adminPrize(env, url, path) {
  if (path === 'stats') {
    const t = await env.DB.prepare('SELECT COUNT(*) AS n, SUM(is_test) AS t FROM prize_codes').first();
    const { results } = await env.DB.prepare('SELECT day, COUNT(*) AS n FROM prize_codes WHERE is_test = 0 GROUP BY day ORDER BY day DESC LIMIT 30').all();
    return json({ valid_codes: (t.n || 0) - (t.t || 0), test_codes: t.t || 0, per_day: results });
  }
  if (path === 'check') {
    const code = (url.searchParams.get('code') || '').trim().toUpperCase();
    if (!CODE_RE.test(code)) return json({ valid: false, reason: 'format' });
    const r = await env.DB.prepare('SELECT day, is_test FROM prize_codes WHERE code = ?').bind(code).first();
    return json(r ? { valid: !r.is_test, test: !!r.is_test, day: r.day } : { valid: false, reason: 'unknown' });
  }
  if (path === 'export') {
    const { results } = await env.DB.prepare('SELECT code, day FROM prize_codes WHERE is_test = 0 ORDER BY code').all();
    await audit(env, 'prize_export', { rows: results.length });
    return csvResponse('gewinnspiel_codes', toCSV(['code', 'day'], results, ','));
  }
  throw new HttpError(404, 'not_found');
}

// ---------------------------------------------------------------- Admin: Einstellungen

async function adminGetSettings(env) {
  const s = await getSettings(env);
  const eff = effectiveItems(s.catalog_overrides);
  const catalog = eff.map((it) => ({
    id: it.id, position: it.position, block: it.block, type: it.type, speeding: it.speeding, words: it.words, words_opt: it.words_opt,
    de: { text: it.de.text, passage: it.de.passage || null, options: it.de.options },
    en: { text: it.en.text, passage: it.en.passage || null, options: it.en.options },
  }));
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM participants WHERE version = ? AND is_test = 0').bind(s.experiment_version).first();
  return json({ settings: s, catalog, frozen: n > 0, real_participants: n });
}

function validateExtras(arr) {
  const bad = (f) => { throw new HttpError(400, 'invalid_setting', { field: `extras.${f}` }); };
  if (!Array.isArray(arr) || arr.length > 30) bad('list');
  const ids = new Set();
  return arr.map((e, i) => {
    if (!isObj(e)) bad(i);
    const id = String(e.id || '');
    if (!/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(id) || /^Q\d+$/i.test(id) || ids.has(id)) bad(`${i}.id`);
    ids.add(id);
    if (!SECTIONS.includes(e.section)) bad(`${id}.section`);
    if (!['choice', 'number', 'smiley'].includes(e.kind)) bad(`${id}.kind`);
    const groups = Array.isArray(e.groups) ? e.groups.filter((g) => GROUPS.includes(g)) : [];
    if (!groups.length) bad(`${id}.groups`);
    const out = { id, section: e.section, kind: e.kind, required: !!e.required, visible: !!e.visible, ordinal: !!e.ordinal, groups };
    if (e.kind === 'choice' && e.multi) { out.multi = true; out.ordinal = false; }
    if (isObj(e.show_if)) {
      const max = e.show_if.max == null ? null : clampInt(e.show_if.max, 1, 5);
      const min = e.show_if.min == null ? null : clampInt(e.show_if.min, 1, 5);
      if (!ids.has(String(e.show_if.item)) || String(e.show_if.item) === id || (max === null && min === null)) bad(`${id}.show_if`);
      out.show_if = { item: String(e.show_if.item), ...(max !== null ? { max } : {}), ...(min !== null ? { min } : {}) };
    }
    if (e.kind === 'number') {
      const min = clampInt(e.min, -1000, 100000), max = clampInt(e.max, -1000, 100000);
      if (min === null || max === null || min > max) bad(`${id}.range`);
      out.min = min; out.max = max;
    }
    for (const l of LANGS) {
      const text = typeof e[l]?.text === 'string' ? e[l].text.trim() : '';
      if (!text || text.length > 400) bad(`${id}.${l}.text`);
      let options = Array.isArray(e[l]?.options) ? e[l].options.map((o) => String(o).trim()).filter(Boolean) : [];
      if (e.kind === 'choice' && (options.length < 2 || options.length > 10 || options.some((o) => o.length > 120))) bad(`${id}.${l}.options`);
      if (e.kind === 'smiley' && (options.length !== 5 || options.some((o) => o.length > 60))) bad(`${id}.${l}.options`); // genau 5 Gesichter
      if (e.kind === 'number') options = [];
      out[l] = { text, options };
    }
    if (e.kind === 'choice' && out.de.options.length !== out.en.options.length) bad(`${id}.options_count`);
    return out;
  });
}

function validateOverrides(obj) {
  const bad = (f) => { throw new HttpError(400, 'invalid_setting', { field: `catalog.${f}` }); };
  if (!isObj(obj)) bad('root');
  const out = {};
  for (const [id, o] of Object.entries(obj)) {
    const base = ITEM_BY_ID[id];
    if (!base || !isObj(o)) bad(id);
    for (const l of LANGS) {
      if (!o[l]) continue;
      const cur = {};
      const t = typeof o[l].text === 'string' ? o[l].text.trim() : '';
      if (!t || t.length > 1500) bad(`${id}.${l}.text`);
      if (t !== base[l].text) cur.text = t;
      if (base[l].passage !== undefined) {
        const ps = typeof o[l].passage === 'string' ? o[l].passage.trim() : '';
        if (!ps || ps.length > 1500) bad(`${id}.${l}.passage`);
        if (ps !== base[l].passage) cur.passage = ps;
      }
      const opts = Array.isArray(o[l].options) ? o[l].options.map((x) => String(x).trim()) : [];
      if (opts.length !== base[l].options.length || opts.some((x) => !x || x.length > 200)) bad(`${id}.${l}.options`);
      if (!same(opts, base[l].options)) cur.options = opts;
      if (Object.keys(cur).length) (out[id] ??= {})[l] = cur;
    }
  }
  return out;
}

async function adminPutSettings(request, env) {
  const b = await readJson(request, 120000);
  const cur = await getSettings(env);
  const next = structuredClone(cur);
  const bad = (field) => { throw new HttpError(400, 'invalid_setting', { field }); };
  const str = (v, max) => (typeof v === 'string' && v.length <= max ? v.trim() : null);
  const langPair = (key, src, max) => {
    for (const l of LANGS) if (l in src) next[key][l] = str(src[l], max) ?? bad(`${key}.${l}`);
  };

  if ('study_active' in b) next.study_active = !!b.study_active;
  if ('site_online' in b) next.site_online = !!b.site_online;
  if (isObj(b.offline_text)) langPair('offline_text', b.offline_text, 500);
  if ('test_mode' in b) next.test_mode = !!b.test_mode;
  if ('open_test' in b) next.open_test = !!b.open_test;
  if ('experiment_version' in b) {
    const v = str(b.experiment_version, 40);
    if (!v || !/^[\w.\-]+$/.test(v)) bad('experiment_version');
    next.experiment_version = v;
  }
  if (isObj(b.speeding_factor)) {
    for (const l of LANGS) {
      if (l in b.speeding_factor) {
        const x = Number(b.speeding_factor[l]);
        if (!(x >= 0.05 && x <= 2)) bad(`speeding_factor.${l}`);
        next.speeding_factor[l] = x;
      }
    }
  }
  if ('word_count_mode' in b) {
    if (!['text', 'text_options'].includes(b.word_count_mode)) bad('word_count_mode');
    next.word_count_mode = b.word_count_mode;
  }
  if (isObj(b.privacy_page)) langPair('privacy_page', b.privacy_page, 20000);
  if (isObj(b.consistency)) {
    if (b.consistency.rule && !['same_side', 'diff'].includes(b.consistency.rule)) bad('consistency.rule');
    const md = b.consistency.min_diff === undefined ? next.consistency.min_diff : clampInt(b.consistency.min_diff, 1, 4);
    if (md === null) bad('consistency.min_diff');
    next.consistency = { rule: b.consistency.rule || next.consistency.rule, min_diff: md };
  }
  if ('abandon_after_min' in b) {
    const m = clampInt(b.abandon_after_min, 5, 1440);
    if (m === null) bad('abandon_after_min');
    next.abandon_after_min = m;
  }
  if (isObj(b.motivation)) {
    for (const l of LANGS) {
      if (!(l in b.motivation)) continue;
      const arr = b.motivation[l];
      if (!Array.isArray(arr) || arr.length !== 3) bad(`motivation.${l}`);
      next.motivation[l] = arr.map((m, i) => {
        const title = str(m?.title, 200), text = str(m?.text, 1000);
        if (!title || text === null) bad(`motivation.${l}.${i}`);
        return { title, text };
      });
    }
  }
  if ('extras' in b) next.extras = validateExtras(b.extras);
  if ('catalog_overrides' in b) next.catalog_overrides = validateOverrides(b.catalog_overrides);
  if (isObj(b.journey)) {
    const w = b.journey.walk_ms === undefined ? next.journey.walk_ms : clampInt(b.journey.walk_ms, 500, 4000);
    if (w === null) bad('journey.walk_ms');
    const easing = b.journey.easing ?? next.journey.easing;
    if (!['standard', 'linear', 'soft'].includes(easing)) bad('journey.easing');
    const pts = b.journey.points_per_answer === undefined ? next.journey.points_per_answer : clampInt(b.journey.points_per_answer, 1, 1000);
    if (pts === null) bad('journey.points_per_answer');
    next.journey = { walk_ms: w, easing, confetti: b.journey.confetti === undefined ? next.journey.confetti : !!b.journey.confetti, points_per_answer: pts, show_points: b.journey.show_points === undefined ? !!next.journey.show_points : !!b.journey.show_points };
  }
  if ('christmas_scene' in b) next.christmas_scene = !!b.christmas_scene;
  if ('default_theme' in b) {
    if (!['system', 'light', 'dark'].includes(b.default_theme)) bad('default_theme');
    next.default_theme = b.default_theme;
  }
  if (isObj(b.contact)) langPair('contact', b.contact, 500);
  if (isObj(b.privacy_extra)) langPair('privacy_extra', b.privacy_extra, 3000);
  if (isObj(b.closing_text)) langPair('closing_text', b.closing_text, 1000);
  if (isObj(b.prize)) {
    if ('enabled' in b.prize) next.prize.enabled = !!b.prize.enabled;
    if ('email' in b.prize) {
      const m = str(b.prize.email, 200);
      if (m === null || (m && !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(m))) bad('prize.email');
      next.prize.email = m;
    }
    if (isObj(b.prize.terms)) for (const l of LANGS) if (l in b.prize.terms) next.prize.terms[l] = str(b.prize.terms[l], 3000) ?? bad(`prize.terms.${l}`);
  }
  if ('redirect_url' in b) {
    const u = str(b.redirect_url, 500);
    if (u === null || (u && !/^https:\/\/[^\s]+$/.test(u))) bad('redirect_url');
    next.redirect_url = u;
  }

  // Sperre: Treatment- und Messkonfiguration einer Version ist nach dem ersten echten Teilnehmenden unveränderlich
  const frozenChanged = FROZEN_KEYS.filter((k) => !same(next[k], cur[k]));
  if (frozenChanged.length && next.experiment_version === cur.experiment_version) {
    const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM participants WHERE version = ? AND is_test = 0')
      .bind(cur.experiment_version).first();
    if (n > 0) throw new HttpError(409, 'version_frozen', { participants: n, version: cur.experiment_version, fields: frozenChanged });
  }

  const changed = Object.keys(next).filter((k) => !same(next[k], cur[k]));
  if (changed.length) {
    await env.DB.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES ('config', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    ).bind(JSON.stringify(next), nowIso()).run();
    await audit(env, 'settings_update', Object.fromEntries(changed.map((k) => [k, { from: cur[k], to: next[k] }])));
  }
  return json({ settings: next, changed });
}

async function adminVersions(env, version) {
  if (version) {
    const r = await env.DB.prepare('SELECT * FROM config_versions WHERE version = ?').bind(version).first();
    if (!r) throw new HttpError(404, 'not_found');
    return new Response(JSON.stringify({ version: r.version, frozen_at: r.frozen_at, catalog_hash: r.catalog_hash, ...JSON.parse(r.snapshot) }, null, 2), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="config_${r.version}.json"`, 'cache-control': 'no-store' },
    });
  }
  const { results } = await env.DB.prepare(
    `SELECT v.version, v.frozen_at, v.catalog_hash,
       (SELECT COUNT(*) FROM participants p WHERE p.version = v.version AND p.is_test = 0) AS participants
     FROM config_versions v ORDER BY v.frozen_at DESC`,
  ).all();
  return json({ versions: results });
}

async function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) throw new HttpError(503, 'admin_not_configured');
  const got = new TextEncoder().encode((request.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  const want = new TextEncoder().encode(env.ADMIN_TOKEN);
  if (got.byteLength !== want.byteLength || !crypto.subtle.timingSafeEqual(got, want)) throw new HttpError(401, 'unauthorized');
}

// ---------------------------------------------------------------- Routing

async function route(request, env, url) {
  const p = url.pathname;
  const m = request.method;

  if (['/api/config', '/api/session', '/api/answer', '/api/extras', '/api/finish', '/api/events'].includes(p)) await requireOnline(request, env);

  if (p === '/api/config' && m === 'GET') return getConfig(env, url);
  if (p === '/api/privacy' && m === 'GET') return getPrivacy(env, url);
  if (p === '/api/session' && m === 'POST') return createSession(request, env);
  if (p === '/api/session' && m === 'GET') return getSession(request, env);
  if (p === '/api/answer' && m === 'POST') return postAnswer(request, env);
  if (p === '/api/extras' && m === 'POST') return postExtras(request, env);
  if (p === '/api/finish' && m === 'POST') return postFinish(request, env);
  if (p === '/api/events' && m === 'POST') return postEvents(request, env);

  if (p.startsWith('/api/admin/')) {
    await requireAdmin(request, env);
    if (p === '/api/admin/settings' && m === 'GET') return adminGetSettings(env);
    if (p === '/api/admin/settings' && m === 'PUT') return adminPutSettings(request, env);
    if (p === '/api/admin/stats' && m === 'GET') return adminStats(env, url);
    if (p === '/api/admin/export' && m === 'GET') return adminExport(env, url);
    if (p === '/api/admin/test-session' && m === 'POST') return adminTestSession(request, env);
    if (p === '/api/admin/versions' && m === 'GET') return adminVersions(env, url.searchParams.get('version'));
    if (p.startsWith('/api/admin/prize/') && m === 'GET') return adminPrize(env, url, p.slice('/api/admin/prize/'.length));
    if (p === '/api/admin/audit' && m === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all();
      return json({ entries: results });
    }
    if (p === '/api/admin/purge-tests' && m === 'POST') {
      const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM participants WHERE is_test = 1').first();
      await env.DB.batch([
        env.DB.prepare('DELETE FROM events WHERE participant_id IN (SELECT id FROM participants WHERE is_test = 1)'),
        env.DB.prepare('DELETE FROM extra_answers WHERE participant_id IN (SELECT id FROM participants WHERE is_test = 1)'),
        env.DB.prepare('DELETE FROM responses WHERE participant_id IN (SELECT id FROM participants WHERE is_test = 1)'),
        env.DB.prepare('DELETE FROM participants WHERE is_test = 1'),
        env.DB.prepare('DELETE FROM prize_codes WHERE is_test = 1'),
      ]);
      await audit(env, 'purge_tests', { deleted: n });
      return json({ deleted: n });
    }
  }
  throw new HttpError(404, 'not_found');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      // Offline: Startseite durch Offline-Hinweis ersetzen (Admin-Vorschau mit ?ts=<Testsitzung> bleibt erreichbar)
      if ((url.pathname === '/' || url.pathname === '/index.html') && !UUID_RE.test(url.searchParams.get('ts') || '')) {
        const s = await getSettings(env).catch(() => null);
        if (s && !s.site_online) return offlinePage(s);
      }
      return env.ASSETS.fetch(request);
    }
    try {
      return await route(request, env, url);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
      console.error(e);
      return json({ error: 'internal_error' }, 500);
    }
  },
};
