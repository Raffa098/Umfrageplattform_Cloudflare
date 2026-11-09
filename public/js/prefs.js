const root = document.documentElement;
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export const isReduced = () => root.dataset.motion === 'reduced';
export const isDark = () => root.dataset.theme === 'dark';
export const hasUserTheme = () => get('as:theme') !== null;

export function setTheme(t, persist = true) {
  root.dataset.theme = t;
  if (persist) set('as:theme', t);
}
export function setMotion(m) {
  root.dataset.motion = m;
  set('as:motion', m);
}
// Admin-Standard gilt nur, solange die Person nichts selbst gewählt hat
export function applyDefaultTheme(def) {
  if (hasUserTheme() || (def !== 'light' && def !== 'dark')) return;
  setTheme(def, false);
}
