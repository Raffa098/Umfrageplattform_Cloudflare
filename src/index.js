import { ITEMS, ITEM_BY_ID, TOTAL, ROLES, publicItems, effectiveItems } from './catalog.js';
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
const FROZEN_KEYS = ['motivation', 'extras', 'catalog_overrides', 'journey'];

export const DEFAULT_SETTINGS = {
  study_active: true,
  test_mode: false,
  open_test: false, // Testfreigabe: Teilnehmende wählen die Gruppe selbst und dürfen wiederholt teilnehmen (Daten = Testdaten)
  experiment_version: 'v1-pilot',
  speeding_factor: { de: 0.3, en: 0.3 }, // Sekunden pro Wort
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
  journey: { walk_ms: 1300, easing: 'standard', confetti: true, points_per_answer: 50 }, // Punkte: fix pro beantworteter Frage
  default_theme: 'system',
  christmas_scene: true, // Weihnachtsszene auf der Abschlussseite (im Admin abschaltbar)
  contact: { de: '', en: '' },
  privacy_extra: { de: '', en: '' },
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
  min: e.min ?? null, max: e.max ?? null, text: e[lang].text, options: e[lang].options,
});

async function extrasState(env, p, s) {
  const { results } = await env.DB.prepare('SELECT item_id FROM extra_answers WHERE participant_id = ?').bind(p.id).all();
  const have = new Set(results.map((r) => r.item_id));
  const items = visibleExtras(s, p.grp);
  const sections = {};
  for (const sec of SECTIONS) {
    const its = items.filter((e) => e.section === sec);
    sections[sec] = { total: its.length, done: its.every((e) => have.has(e.id)) };
  }
  return { items, sections, allDone: SECTIONS.every((sec) => sections[sec].done) };
}

// ---------------------------------------------------------------- Teilnehmende

async function getParticipant(request, env) {
  const id = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!UUID_RE.test(id)) throw new HttpError(401, 'no_session');
  const p = await env.DB.prepare('SELECT * FROM participants WHERE id = ?').bind(id).first();
  if (!p) throw new HttpError(404, 'unknown_session');
  return p;
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
       device_mobile, viewport_w, viewport_h, dark_mode, reduced_motion, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, group, lang, s.experiment_version, isTest, now, source,
    flag01(device.mobile), clampInt(device.w, 0, 10000), clampInt(device.h, 0, 10000), flag01(device.dark), flag01(device.reduced), now, now,
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
  const rows = [];
  for (const e of items) {
    const raw = given[e.id] === undefined || given[e.id] === null ? '' : String(given[e.id]).trim();
    if (raw === '') {
      if (e.required) throw new HttpError(400, 'required_missing', { item: e.id });
      rows.push([e.id, '']);
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

function evaluate(p, rs, s) {
  const factor = Number(s.speeding_factor?.[p.lang]) || 0.3;
  const cat = Object.fromEntries(effectiveItems(s.catalog_overrides).map((it) => [it.id, it]));
  const by = {};
  let sc = 0, sn = 0, hidden = 0;
  const items = rs.map((r) => {
    const it = cat[r.item_id];
    by[r.item_id] = r.value;
    hidden += r.hidden_ms || 0;
    const words = it ? it.words[p.lang] : null;
    let threshold = null, speeding = null;
    if (it?.speeding) {
      threshold = Math.round(factor * words * 1000);
      speeding = r.rt_ms < threshold ? 1 : 0;
      sc += speeding;
      sn++;
    }
    return { ...r, item_type: it?.type ?? null, words, speeding_threshold_ms: threshold, speeding };
  });
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
      q09: by[ROLES.comprehension] ?? null,
      q14: by[ROLES.bogus] ?? null,
      total_hidden_ms: hidden,
    },
  };
}

function parseFilters(url) {
  const q = url.searchParams;
  const block = Number(q.get('block'));
  return {
    group: GROUPS.includes(q.get('group')) ? q.get('group') : null,
    lang: LANGS.includes(q.get('lang')) ? q.get('lang') : null,
    version: q.get('version') || null,
    includeTest: q.get('include_test') === '1',
    completedOnly: q.get('completed_only') === '1',
    block: [1, 2, 3].includes(block) ? block : null,
    item: ITEM_BY_ID[q.get('item')] ? q.get('item') : null,
  };
}

function whereClause(f) {
  const w = [], binds = [];
  if (!f.includeTest) w.push('p.is_test = 0');
  if (f.group) { w.push('p.grp = ?'); binds.push(f.group); }
  if (f.lang) { w.push('p.lang = ?'); binds.push(f.lang); }
  if (f.version) { w.push('p.version = ?'); binds.push(f.version); }
  if (f.completedOnly) w.push('p.completed_at IS NOT NULL');
  return { sql: w.length ? `WHERE ${w.join(' AND ')}` : '', binds };
}

async function loadData(env, f) {
  const { sql, binds } = whereClause(f);
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

async function loadExtraAnswers(env, f) {
  const { sql, binds } = whereClause(f);
  const { results } = await env.DB.prepare(
    `SELECT e.participant_id, e.item_id, e.value, p.grp FROM extra_answers e JOIN participants p ON p.id = e.participant_id ${sql}`,
  ).bind(...binds).all();
  return results;
}

const statusOf = (p, s, now = Date.now()) =>
  p.completed_at ? 'completed'
    : now - Date.parse(p.last_seen_at || p.created_at) > s.abandon_after_min * 60000 ? 'abandoned' : 'in_progress';

async function adminStats(env, url) {
  const s = await getSettings(env);
  const f = parseFilters(url);
  const { participants, responsesBy } = await loadData(env, f);
  const mk = () => ({
    started: 0, completed: 0, in_progress: 0, abandoned: 0, main_completed: 0,
    speeding: [0, 0], bogus: [0, 0], consistency: [0, 0], comprehension: [0, 0],
    blocks: [[0, 0], [0, 0], [0, 0]], durations: [], rts: [],
  });
  const total = mk();
  const groups = Object.fromEntries(GROUPS.map((g) => [g, mk()]));
  const langs = { de: 0, en: 0 };
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
  }
  const fin = ({ durations, rts, ...a }) => ({ ...a, median_duration_s: median(durations), median_rt_ms: median(rts) });

  // Manipulationschecks / Kontrollvariablen je Gruppe
  const extras = {};
  for (const r of await loadExtraAnswers(env, f)) {
    if (r.value === '') continue;
    const e = (extras[r.item_id] ??= {});
    const g = (e[r.grp] ??= { n: 0, sum: 0, dist: {} });
    g.n++;
    g.sum += Number(r.value);
    g.dist[r.value] = (g.dist[r.value] || 0) + 1;
  }
  for (const e of Object.values(extras)) for (const g of Object.values(e)) { g.mean = Number((g.sum / g.n).toFixed(2)); delete g.sum; }

  const { results: versions } = await env.DB.prepare(
    'SELECT version, COUNT(*) AS n FROM participants GROUP BY version ORDER BY MIN(created_at)',
  ).all();
  const snap = await env.DB.prepare('SELECT catalog_hash FROM config_versions WHERE version = ?').bind(s.experiment_version).first();
  return json({
    generated_at: nowIso(),
    current_version: s.experiment_version,
    catalog_mismatch: !!snap && snap.catalog_hash !== (await sha256(CATALOG_HASH_SRC)),
    total: fin(total),
    groups: Object.fromEntries(GROUPS.map((g) => [g, fin(groups[g])])),
    langs,
    versions,
    extras,
    extras_meta: s.extras.map((e) => ({ id: e.id, section: e.section, kind: e.kind, ordinal: e.ordinal, text: e.de.text, options: e.de.options })),
  });
}

const BASE_COLS = ['participant_id', 'group', 'gamification', 'motivation', 'lang', 'version', 'is_test', 'source',
  'device_mobile', 'viewport_w', 'viewport_h', 'dark_mode', 'reduced_motion'];
const PERSON_COLS = [...BASE_COLS, 'started_at', 'main_completed_at', 'completed_at', 'status', 'duration_s', 'n_answered', 'speeding_items',
  'speeding_count', 'speeding_share', 'bogus', 'consistency', 'comprehension', 'q06', 'q10', 'q09', 'q14', 'total_hidden_ms'];
const EXPORT_COLS = {
  item: [...BASE_COLS, 'block', 'position', 'item_id', 'item_type', 'value', 'rt_ms', 'first_click_ms', 'hidden_ms',
    'changes', 'words', 'speeding_threshold_ms', 'speeding', 'answered_at'],
  events: ['participant_id', 'group', 'lang', 'version', 'is_test', 'event_id', 'type', 'item_id', 'client_ts', 'data', 'created_at'],
};

function toCSV(cols, rows, sep) {
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`; // Formel-Injection verhindern
    return /["\n\r,;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.join(sep), ...rows.map((r) => cols.map((c) => cell(r[c])).join(sep))].join('\r\n') + '\r\n';
}

const csvResponse = (name, body) =>
  new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${name}_${nowIso().slice(0, 16).replace(/[:T]/g, '-')}.csv"`,
      'cache-control': 'no-store',
    },
  });

async function adminExport(env, url) {
  const s = await getSettings(env);
  const f = parseFilters(url);
  const level = ['item', 'person', 'events'].includes(url.searchParams.get('level')) ? url.searchParams.get('level') : 'person';
  const sep = url.searchParams.get('sep') === 'semicolon' ? ';' : ',';
  const rows = [];
  const base = (p) => ({
    participant_id: p.id, group: p.grp, gamification: p.grp === 'gamification' ? 1 : 0, motivation: p.grp === 'motivation' ? 1 : 0,
    lang: p.lang, version: p.version, is_test: p.is_test, source: p.source, device_mobile: p.device_mobile,
    viewport_w: p.viewport_w, viewport_h: p.viewport_h, dark_mode: p.dark_mode, reduced_motion: p.reduced_motion,
  });
  let cols = EXPORT_COLS[level];

  if (level === 'events') {
    const { sql, binds } = whereClause(f);
    const { results } = await env.DB.prepare(
      `SELECT e.*, p.grp, p.lang, p.version, p.is_test FROM events e JOIN participants p ON p.id = e.participant_id ${sql} ORDER BY e.id`,
    ).bind(...binds).all();
    for (const e of results) {
      rows.push({
        participant_id: e.participant_id, group: e.grp, lang: e.lang, version: e.version, is_test: e.is_test,
        event_id: e.id, type: e.type, item_id: e.item_id, client_ts: e.client_ts, data: e.data, created_at: e.created_at,
      });
    }
  } else {
    const { participants, responsesBy } = await loadData(env, f);
    const now = Date.now();
    // Zusatzfragen als Spalten x_<id> (alle in der Konfiguration vorhandenen und alle je beantworteten Items)
    const xAns = new Map();
    const xIds = new Set(s.extras.map((e) => e.id));
    if (level === 'person') {
      for (const r of await loadExtraAnswers(env, f)) {
        xIds.add(r.item_id);
        if (!xAns.has(r.participant_id)) xAns.set(r.participant_id, {});
        xAns.get(r.participant_id)[`x_${r.item_id}`] = r.value;
      }
      cols = [...PERSON_COLS, ...[...xIds].map((id) => `x_${id}`)];
    }
    for (const p of participants) {
      const { person, items } = evaluate(p, responsesBy.get(p.id) || [], s);
      if (level === 'item') {
        for (const it of items) {
          if ((f.block && it.block !== f.block) || (f.item && it.item_id !== f.item)) continue;
          rows.push({
            ...base(p), block: it.block, position: it.position, item_id: it.item_id, item_type: it.item_type, value: it.value,
            rt_ms: it.rt_ms, first_click_ms: it.first_click_ms, hidden_ms: it.hidden_ms, changes: it.changes, words: it.words,
            speeding_threshold_ms: it.speeding_threshold_ms, speeding: it.speeding, answered_at: it.created_at,
          });
        }
      } else {
        rows.push({
          ...base(p), started_at: p.created_at, main_completed_at: p.main_completed_at, completed_at: p.completed_at, status: statusOf(p, s, now),
          duration_s: p.completed_at ? Math.round((Date.parse(p.completed_at) - Date.parse(p.created_at)) / 1000) : null,
          ...person, ...(xAns.get(p.id) || {}),
        });
      }
    }
  }
  await audit(env, 'export', { level, rows: rows.length, filters: f });
  return csvResponse(`export_${level}`, toCSV(cols, rows, sep));
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
    id: it.id, position: it.position, block: it.block, type: it.type, speeding: it.speeding, words: it.words,
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
    next.journey = { walk_ms: w, easing, confetti: b.journey.confetti === undefined ? next.journey.confetti : !!b.journey.confetti, points_per_answer: pts };
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

  if (p === '/api/config' && m === 'GET') return getConfig(env, url);
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
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, env, url);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status);
      console.error(e);
      return json({ error: 'internal_error' }, 500);
    }
  },
};
