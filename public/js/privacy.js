// Datenschutzerklärung (DSGVO): Text kommt aus den Einstellungen (Adminbereich), Darstellung ohne innerHTML-Rohtext.
const T = {
  de: { title: 'Datenschutzerklärung', sub: 'Hinweise zur Verarbeitung deiner Daten nach DSGVO', back: 'Zurück zur Umfrage', close: 'Fenster schließen', err: 'Die Datenschutzerklärung konnte nicht geladen werden. Bitte versuche es später erneut.', contact: 'Kontakt', version: 'Stand' },
  en: { title: 'Privacy notice', sub: 'Information on how your data are processed (GDPR)', back: 'Back to the survey', close: 'Close window', err: 'The privacy notice could not be loaded. Please try again later.', contact: 'Contact', version: 'Version' },
};
const $ = (id) => document.getElementById(id);
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

let lang = new URLSearchParams(location.search).get('lang');
if (!['de', 'en'].includes(lang)) {
  try { lang = JSON.parse(read('decision-study:v2') || '{}').lang; } catch { lang = null; }
}
if (!['de', 'en'].includes(lang)) lang = (navigator.language || 'de').startsWith('de') ? 'de' : 'en';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// "## Überschrift", Absätze durch Leerzeilen, "- " = Aufzählung; [Platzhalter] werden hervorgehoben
function inline(parent, text) {
  text.split(/(\[[^\]]+\])/).forEach((part) => {
    if (!part) return;
    parent.append(/^\[[^\]]+\]$/.test(part) ? el('mark', 'ph', part) : document.createTextNode(part));
  });
}
function render(text) {
  const frag = document.createDocumentFragment();
  let list = null, para = null;
  const endPara = () => { para = null; };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) { endPara(); list = null; continue; }
    if (line.startsWith('## ')) { endPara(); list = null; frag.append(el('h2', null, line.slice(3))); continue; }
    if (line.startsWith('- ')) {
      endPara();
      if (!list) { list = el('ul'); frag.append(list); }
      const li = el('li'); inline(li, line.slice(2)); list.append(li);
      continue;
    }
    list = null;
    if (!para) { para = el('p'); frag.append(para); } else para.append(document.createElement('br'));
    inline(para, line);
  }
  return frag;
}

async function load() {
  const t = T[lang];
  document.documentElement.lang = lang;
  document.title = t.title;
  $('langDe').setAttribute('aria-pressed', String(lang === 'de'));
  $('langEn').setAttribute('aria-pressed', String(lang === 'en'));
  const opener = !!window.opener || history.length <= 1;
  $('backBtn').textContent = opener ? t.close : t.back;
  const page = $('page');
  page.replaceChildren(el('p', 'muted', '…'));
  try {
    const r = await fetch(`/api/privacy?lang=${lang}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    const head = el('div', 'privacy-head');
    head.append(el('p', 'kicker', 'DSGVO'), el('h1', null, t.title), el('p', 'lead', t.sub));
    const body = el('div', 'privacy-body');
    body.append(render(d.text));
    if (d.extra) { body.append(el('h2', null, t.contact)); body.append(render(d.extra)); }
    if (d.contact) { const p = el('p'); p.append(el('b', null, `${t.contact}: `), document.createTextNode(d.contact)); body.append(p); }
    body.append(el('p', 'muted small', `${t.version}: ${d.version}`));
    page.replaceChildren(head, body);
  } catch {
    page.replaceChildren(el('p', null, t.err));
  }
}

$('langDe').addEventListener('click', () => { lang = 'de'; history.replaceState(null, '', '?lang=de'); load(); });
$('langEn').addEventListener('click', () => { lang = 'en'; history.replaceState(null, '', '?lang=en'); load(); });
$('backBtn').addEventListener('click', () => {
  window.close();
  // Wenn das Fenster nicht per Skript geschlossen werden kann (kein Opener), zurück zur Umfrage
  setTimeout(() => { if (history.length > 1) history.back(); else location.href = '/'; }, 150);
});
load();
