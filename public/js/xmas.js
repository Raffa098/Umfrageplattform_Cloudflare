// Weihnachtsszene für die Abschlussseite: beleuchteter Baum mit Geschenken, großer rothaariger Sänger
// (eigene Zeichenfigur, keine reale Person), Notenzeichen und Schneefall. Rein dekorativ.

const rand = (seed) => { let r = seed; return () => ((r = (r * 9301 + 49297) % 233280) / 233280); };

const note = (x, y, d, c) => `<g transform="translate(${x} ${y})"><g class="xs-note" style="animation-delay:${d}s">
  <ellipse cx="0" cy="0" rx="2.9" ry="2.1" fill="${c}" transform="rotate(-20)"/>
  <path d="M2.5 -.7 V-11.5 q4.6 .6 4.8 5.8" fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/></g></g>`;

const bauble = (x, y, c, d) => `<circle class="xs-bb" cx="${x}" cy="${y}" r="3.2" fill="${c}" style="animation-delay:${d}s"/><circle cx="${x - 0.9}" cy="${y - 1}" r=".85" fill="#fff" opacity=".75"/>`;

function gift(x, y, w, h, c, rib) {
  const mx = x + w / 2;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${c}"/>
    <rect x="${x}" y="${y + h * 0.36}" width="${w}" height="3" fill="${rib}" opacity=".95"/><rect x="${mx - 1.5}" y="${y}" width="3" height="${h}" fill="${rib}" opacity=".95"/>
    <path d="M${mx} ${y} q-7 -7 -8.2 -1.6 q4 3 8.2 1.6 q4.2 1.4 8.2 -1.6 q-1.2 -5.4 -8.2 1.6Z" fill="${rib}"/>
    <rect x="${x}" y="${y}" width="${w}" height="2" rx="1" fill="#fff" opacity=".16"/></g>`;
}

export function xmasSVG() {
  const r = rand(7);
  const stars = Array.from({ length: 22 }, (_, i) => `<circle class="xs-star" cx="${(r() * 356 + 2).toFixed(1)}" cy="${(r() * 92 + 4).toFixed(1)}" r="${(r() * 0.9 + 0.5).toFixed(2)}" style="animation-delay:-${(r() * 4).toFixed(1)}s"/>`).join('');
  const snow = Array.from({ length: 30 }, () => `<circle class="xs-snow" cx="${(r() * 360).toFixed(1)}" cy="-6" r="${(r() * 1.3 + 0.8).toFixed(2)}" style="--dx:${(r() * 24 - 12).toFixed(0)}px;animation-duration:${(r() * 4 + 5).toFixed(1)}s;animation-delay:-${(r() * 8).toFixed(1)}s"/>`).join('');
  const lights = [[82, 72], [96, 77], [114, 78], [128, 72], [72, 100], [92, 108], [118, 110], [138, 100], [62, 126], [88, 137], [122, 138], [148, 126]]
    .map(([x, y], i) => `<circle class="xs-light" cx="${x}" cy="${y}" r="1.7" fill="${['#ffe27a', '#ff8f8f', '#9fd8ff', '#b9ff9f'][i % 4]}" style="animation-delay:-${(i * 0.37).toFixed(2)}s"/>`).join('');

  const tree = `<g>
    <rect x="98" y="132" width="14" height="16" rx="2" fill="#7a4a2b"/>
    <path d="M105 52 L146 102 H64Z" fill="#1d6f47"/><path d="M105 74 L156 132 H54Z" fill="#1a6040"/><path d="M105 30 L137 78 H73Z" fill="#23885a"/>
    <path d="M105 52 L146 102 H64Z" fill="#2a9b66" opacity=".35"/>
    <path d="M73 78 Q89 84 105 78 Q121 84 137 78 L105 30Z" fill="#fff" opacity=".18"/>
    <path d="M64 102 Q74 109 85 102 Q96 109 105 102 Q114 109 125 102 Q136 109 146 102" fill="none" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/>
    <path d="M78 74 Q105 88 132 74 M66 100 Q105 118 144 100 M56 128 Q105 150 154 128" fill="none" stroke="#f2c14e" stroke-width="1.6" stroke-linecap="round"/>
    ${lights}
    ${bauble(96, 62, '#e0463a', 0)}${bauble(116, 68, '#4aa3ff', 0.6)}${bauble(86, 90, '#f2c14e', 1.1)}${bauble(124, 94, '#e0463a', 0.3)}
    ${bauble(104, 104, '#ffffff', 0.9)}${bauble(76, 118, '#4aa3ff', 1.4)}${bauble(134, 120, '#f2c14e', 0.5)}${bauble(100, 124, '#e0463a', 1.7)}
    <g class="xs-topstar"><circle cx="105" cy="29" r="9" fill="#ffe27a" opacity=".35"/><path d="M105 19 l2.8 6.2 6.8 .7 -5.1 4.6 1.5 6.7 -6 -3.5 -6 3.5 1.5 -6.7 -5.1 -4.6 6.8 -.7Z" fill="#ffd34d"/></g>
  </g>`;

  const gifts = `${gift(40, 128, 22, 20, '#d9473a', '#ffe27a')}${gift(64, 134, 16, 14, '#3f86d9', '#ffffff')}
    ${gift(118, 130, 22, 18, '#2f9e63', '#ff6f6f')}${gift(142, 136, 15, 12, '#f2c14e', '#7b4fd1')}${gift(92, 139, 11, 9, '#e56fb0', '#ffffff')}`;

  // Sänger: Ursprung = Füße, y nach oben negativ
  const singer = `<g transform="translate(262 152) scale(1.2)"><g class="xs-sing">
    <ellipse cx="0" cy="0" rx="24" ry="3.6" fill="rgba(0,0,0,.28)"/>
    <rect x="-10.5" y="-50" width="9" height="48" rx="3.2" fill="#2d3b5a"/><rect x="1.5" y="-50" width="9" height="48" rx="3.2" fill="#2d3b5a"/>
    <rect x="-13" y="-5" width="12.5" height="6" rx="3" fill="#1b1b22"/><rect x="0.5" y="-5" width="12.5" height="6" rx="3" fill="#1b1b22"/>
    <g class="xs-arm-l"><rect x="-24.5" y="-88" width="8.4" height="34" rx="4.2" fill="#154a33"/><circle cx="-20.3" cy="-52" r="4.6" fill="#f2c29b"/></g>
    <rect x="-18" y="-94" width="36" height="50" rx="12" fill="#1f5a3f"/>
    <path d="M-15 -94 Q0 -84 15 -94 V-86 Q0 -76 -15 -86Z" fill="#d83a3a"/><path d="M-10 -89 l2 7 M-3 -87 l2 8 M4 -88 l2 7 M10 -91 l1.5 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <rect x="7" y="-86" width="8" height="24" rx="2.4" fill="#d83a3a"/><path d="M7 -78 h8 M7 -70 h8" stroke="#fff" stroke-width="2"/>
    <circle cx="0" cy="-66" r="1.3" fill="#c7d8cf"/><circle cx="0" cy="-58" r="1.3" fill="#c7d8cf"/><circle cx="0" cy="-50" r="1.3" fill="#c7d8cf"/>
    <circle cx="-13.2" cy="-105" r="3.4" fill="#e9b58b"/><circle cx="13.2" cy="-105" r="3.4" fill="#e9b58b"/>
    <circle cx="0" cy="-105" r="13.4" fill="#f2c29b"/>
    <path class="xs-hair" d="M-13.4 -107.6 Q-14.6 -118 -6.4 -121.2 Q0 -123.4 7.6 -120.8 Q14.8 -116.6 13.4 -107.6 Q11.6 -111.2 8.6 -111.6 Q5 -114.4 0 -111.4 Q-5 -114 -8.6 -111 Q-11.6 -110.4 -13.4 -107.6Z"/>
    <path class="xs-hair" d="M-9 -120 Q-7 -134 6 -133 Q16 -131.5 17 -122 Q10 -126.4 3 -121.4 Q-3 -123 -9 -120Z"/>
    <path class="xs-hair" d="M-2 -131 Q4 -141 12 -134 Q7 -135.6 3 -130Z"/>
    <path d="M-8.2 -107.2 q2.5 -2.7 5 0 M3.2 -107.2 q2.5 -2.7 5 0" fill="none" stroke="#3a2a22" stroke-width="1.5" stroke-linecap="round"/>
    <path class="xs-hair-b" d="M-9 -111 q3 -1.6 6 0 M3 -111 q3 -1.6 6 0" fill="none" stroke="#c24a24" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="0" cy="-102" r="1.7" fill="#e9a982"/>
    <ellipse class="xs-mouth" cx="0" cy="-95.6" rx="3.9" ry="3.3" fill="#5a1f24"/>
    <g class="xs-arm-r"><path d="M14 -86 Q28 -82 14.6 -98.4" fill="none" stroke="#1f5a3f" stroke-width="8.4" stroke-linecap="round"/>
      <circle cx="14.4" cy="-99" r="4.7" fill="#f2c29b"/>
      <rect x="10.4" y="-114.2" width="6.6" height="14" rx="3.3" fill="#2a2e38" transform="rotate(14 13.7 -107)"/><circle cx="13.2" cy="-114.4" r="3.9" fill="#aab3c2" transform="rotate(14 13.7 -107)"/></g>
  </g></g>`;

  return `<svg viewBox="0 -18 360 198" role="img" focusable="false" aria-hidden="true">
    <defs>
      <linearGradient id="xs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1633"/><stop offset=".7" stop-color="#26376a"/><stop offset="1" stop-color="#3b4f8a"/></linearGradient>
      <radialGradient id="xs-moon"><stop offset="0" stop-color="#fff7d6" stop-opacity=".9"/><stop offset="1" stop-color="#fff7d6" stop-opacity="0"/></radialGradient>
    </defs>
    <rect y="-18" width="360" height="198" fill="url(#xs-sky)"/>
    <g>${stars}</g>
    <circle cx="322" cy="30" r="26" fill="url(#xs-moon)"/><circle cx="322" cy="30" r="12" fill="#fff4cf"/><circle cx="326" cy="27" r="11" fill="#2b3c70" opacity=".0"/>
    <path d="M0 132 Q70 112 150 128 T300 122 T360 126 V180 H0Z" fill="#c9d8ee"/>
    <path d="M0 148 Q90 138 180 148 T360 146 V180 H0Z" fill="#eef4fc"/>
    ${tree}${gifts}${singer}
    ${note(300, 52, 0, '#ffd34d')}${note(322, 70, 0.9, '#ff9ad5')}${note(296, 80, 1.7, '#9fd8ff')}${note(318, 44, 2.4, '#b9ff9f')}
    <g>${snow}</g>
  </svg>`;
}
