// Läuft synchron im <head>: setzt Farbschema und Bewegungsmodus vor dem ersten Rendern (kein Aufblitzen).
// Nutzerwahl (localStorage) hat Vorrang vor Systemeinstellung bzw. Admin-Standard.
(function () {
  var root = document.documentElement;
  var mq = function (q) { return window.matchMedia(q); };
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function apply() {
    var t = read('as:theme');
    root.dataset.theme = t || (mq('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var m = read('as:motion');
    root.dataset.motion = m || (mq('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full');
  }
  apply();
  mq('(prefers-color-scheme: dark)').addEventListener('change', apply);
  mq('(prefers-reduced-motion: reduce)').addEventListener('change', apply);
})();
