// Weihnachtsszene für die Abschlussseite: beleuchteter Baum mit Geschenken, großer rothaariger Sänger am Mikrofonständer
// (eigene Zeichenfigur, keine reale Person), im Hintergrund Schlagzeuger und Gitarrist, Notenzeichen und Schneefall.
// Rein dekorativ.

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

// Weihnachtsmütze für die Band (Ursprung = Kopfmitte)
const santaHat = (r) => `<path d="M${-r - 0.4} ${-r * 0.2} Q${-r * 0.5} ${-r * 2.1} ${r * 1.5} ${-r * 0.9} Q${r * 0.9} ${-r * 0.9} ${r * 0.85} ${-r * 0.2}Z" fill="#d83a3a"/>
  <rect x="${-r - 0.8}" y="${-r * 0.5}" width="${r * 2 + 1.6}" height="${r * 0.46}" rx="${r * 0.23}" fill="#fff"/><circle cx="${r * 1.55}" cy="${-r * 0.95}" r="${r * 0.34}" fill="#fff"/>`;

// Schlagzeuger (sitzt hinter dem Set, Mütze, Sticks bewegen sich)
function drummer(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <g class="xs-nod">
      <rect x="-8.5" y="-55" width="17" height="30" rx="6" fill="#2d3b5a"/>
      <circle cx="0" cy="-63" r="8" fill="#f2c29b"/>
      <circle cx="-2.8" cy="-63.6" r="1" fill="#3a2a22"/><circle cx="2.8" cy="-63.6" r="1" fill="#3a2a22"/><path d="M-2.4 -60 q2.4 2.2 4.8 0" fill="none" stroke="#7a3a2a" stroke-width="1.1" stroke-linecap="round"/>
      <g transform="translate(0 -63)">${santaHat(8)}</g>
      <g class="xs-stick xs-stick-a"><rect x="-10.5" y="-52" width="4.6" height="19" rx="2.3" fill="#2d3b5a"/><path d="M-8 -35 L-17 -27" stroke="#ead9b4" stroke-width="1.5" stroke-linecap="round"/></g>
      <g class="xs-stick xs-stick-b"><rect x="5.9" y="-52" width="4.6" height="19" rx="2.3" fill="#2d3b5a"/><path d="M8 -35 L17 -29" stroke="#ead9b4" stroke-width="1.5" stroke-linecap="round"/></g>
    </g>
    <rect x="-26" y="-27" width="16" height="9" rx="2" fill="#c0392b"/><ellipse cx="-18" cy="-27" rx="8.6" ry="3.2" fill="#f4f0e6" stroke="#cfd6e2" stroke-width=".8"/>
    <rect x="1" y="-35" width="13" height="8" rx="2" fill="#c0392b"/><ellipse cx="7.5" cy="-35" rx="6.8" ry="2.7" fill="#f4f0e6" stroke="#cfd6e2" stroke-width=".8"/>
    <circle cx="0" cy="-15" r="15" fill="#c0392b"/><circle cx="0" cy="-15" r="12" fill="#f4f0e6"/>
    <path d="M0 -21.5 l1.9 4 4.4 .5 -3.3 3 .9 4.3 -3.9 -2.2 -3.9 2.2 .9 -4.3 -3.3 -3 4.4 -.5Z" fill="#c0392b"/>
    <path d="M-34 -40 V-6" stroke="#aab3c2" stroke-width="1.4"/><ellipse cx="-34" cy="-40" rx="8" ry="1.8" fill="#e8c25a"/>
    <g class="xs-cymbal"><path d="M26 -52 V-14" stroke="#aab3c2" stroke-width="1.4"/><ellipse cx="26" cy="-52" rx="10" ry="2.2" fill="#e8c25a"/></g>
    <ellipse cx="22" cy="-22" rx="7" ry="2.6" fill="#f4f0e6" stroke="#cfd6e2" stroke-width=".8"/><rect x="15" y="-22" width="14" height="9" rx="2" fill="#c0392b"/>
  </g>`;
}

// Gitarrist (sitzt auf einem Hocker, Mütze, schlägt die Akustikgitarre an)
function guitarist(x, y, s) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-10" y="-23" width="20" height="3.6" rx="1.8" fill="#7a4a2b"/><path d="M-6.5 -19.5 L-9 0 M6.5 -19.5 L9 0" stroke="#7a4a2b" stroke-width="2" stroke-linecap="round"/>
    <rect x="-6" y="-26" width="21" height="8" rx="4" fill="#3a4a6a"/><rect x="9" y="-22" width="7.6" height="22" rx="3.8" fill="#3a4a6a"/><rect x="8" y="-3.6" width="13" height="4.8" rx="2.4" fill="#1b1b22"/>
    <g class="xs-nod">
      <rect x="-9" y="-54" width="17" height="30" rx="6" fill="#7a3a2a"/>
      <circle cx="-0.5" cy="-62" r="7.8" fill="#e6b48e"/>
      <circle cx="-3.2" cy="-62.6" r="1" fill="#3a2a22"/><circle cx="2.2" cy="-62.6" r="1" fill="#3a2a22"/><path d="M-2.8 -59 q2.6 2.2 5.2 0" fill="none" stroke="#7a3a2a" stroke-width="1.1" stroke-linecap="round"/>
      <g transform="translate(-0.5 -62)">${santaHat(7.8)}</g>
    </g>
    <g transform="rotate(-16 6 -30)"><rect x="12" y="-44.5" width="31" height="4.6" rx="2" fill="#6b4126" transform="rotate(-34 12 -42)"/>
      <rect x="35" y="-67" width="8.4" height="5.4" rx="1.6" fill="#4a2c18" transform="rotate(-34 12 -42)"/>
      <ellipse cx="4" cy="-27.5" rx="12.4" ry="10" fill="#c98a4b"/><ellipse cx="6.4" cy="-40.2" rx="9" ry="7.6" fill="#c98a4b"/>
      <circle cx="5" cy="-30" r="3.8" fill="#3a2a22"/><path d="M-7 -27.5 H15" stroke="rgba(255,255,255,.3)" stroke-width=".8"/></g>
    <path d="M4 -50 Q19 -52 27 -60" fill="none" stroke="#7a3a2a" stroke-width="5.2" stroke-linecap="round"/><circle cx="27.6" cy="-60.8" r="2.7" fill="#e6b48e"/>
    <g class="xs-strum"><path d="M-5 -48 Q-1 -38 4.5 -31" fill="none" stroke="#7a3a2a" stroke-width="5.2" stroke-linecap="round"/><circle cx="5" cy="-30" r="2.7" fill="#e6b48e"/></g>
  </g>`;
}

export function xmasSVG() {
  const r = rand(7);
  const stars = Array.from({ length: 22 }, () => `<circle class="xs-star" cx="${(r() * 356 + 2).toFixed(1)}" cy="${(r() * 92 + 4).toFixed(1)}" r="${(r() * 0.9 + 0.5).toFixed(2)}" style="animation-delay:-${(r() * 4).toFixed(1)}s"/>`).join('');
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

  // Band im Hintergrund (kleiner, auf dem hinteren Hügel)
  const band = `${guitarist(206, 143, 0.74)}${drummer(322, 142, 0.72)}`;

  // Sänger: Ursprung = Füße, y nach oben negativ. Mikrofon steht auf einem Ständer.
  const singer = `<g transform="translate(262 152) scale(1.2)"><g class="xs-sing">
    <ellipse cx="0" cy="0" rx="26" ry="3.6" fill="rgba(0,0,0,.28)"/>
    <rect x="-10.5" y="-50" width="9" height="48" rx="3.2" fill="#2d3b5a"/><rect x="1.5" y="-50" width="9" height="48" rx="3.2" fill="#2d3b5a"/>
    <rect x="-13" y="-5" width="12.5" height="6" rx="3" fill="#1b1b22"/><rect x="0.5" y="-5" width="12.5" height="6" rx="3" fill="#1b1b22"/>
    <path class="xs-stand" d="M28 -7 L18.5 0 M28 -7 L37.5 0 M28 -7 V0"/><path class="xs-stand" d="M28 -7 V-90 Q28 -98.5 22.5 -98.5"/>
    
    <g class="xs-arm-l"><rect x="-24.5" y="-88" width="8.4" height="34" rx="4.2" fill="#154a33"/><circle cx="-20.3" cy="-52" r="4.6" fill="#f2c29b"/></g>
    <rect x="-18" y="-94" width="36" height="50" rx="12" fill="#1f5a3f"/>
    <path d="M-15 -94 Q0 -84 15 -94 V-86 Q0 -76 -15 -86Z" fill="#d83a3a"/><path d="M-10 -89 l2 7 M-3 -87 l2 8 M4 -88 l2 7 M10 -91 l1.5 6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    <rect x="7" y="-86" width="8" height="24" rx="2.4" fill="#d83a3a"/><path d="M7 -78 h8 M7 -70 h8" stroke="#fff" stroke-width="2"/>
    <circle cx="0" cy="-66" r="1.3" fill="#c7d8cf"/><circle cx="0" cy="-58" r="1.3" fill="#c7d8cf"/><circle cx="0" cy="-50" r="1.3" fill="#c7d8cf"/>
    <circle cx="-13.2" cy="-105" r="3.4" fill="#e9b58b"/><circle cx="13.2" cy="-105" r="3.4" fill="#e9b58b"/>
    <circle cx="0" cy="-105" r="13.4" fill="#f2c29b"/>
    <path class="xs-hair" d="M-13.4 -107.6 Q-14.2 -115 -9 -118 Q0 -121 9 -118 Q14.2 -115 13.4 -107.6 Q11 -111 8 -111.4 Q4 -113.6 0 -111 Q-4.4 -113.4 -8 -111.2 Q-11.4 -110.6 -13.4 -107.6Z"/>
    <circle class="xs-hair" cx="-9" cy="-120.5" r="5.6"/><circle class="xs-hair2" cx="-2.6" cy="-124.6" r="6.6"/><circle class="xs-hair" cx="5.4" cy="-124" r="6.3"/>
    <circle class="xs-hair2" cx="12.2" cy="-119.6" r="5"/><circle class="xs-hair" cx="-13" cy="-116" r="4.2"/><circle class="xs-hair2" cx="1.6" cy="-120.4" r="5.4"/>
    <circle class="xs-hair" cx="-6" cy="-129.4" r="3.3"/><circle class="xs-hair" cx="8.6" cy="-129" r="3.5"/><circle class="xs-hair2" cx="1.4" cy="-130.6" r="3"/>
    <path d="M-8.2 -107.2 q2.5 -2.7 5 0 M3.2 -107.2 q2.5 -2.7 5 0" fill="none" stroke="#3a2a22" stroke-width="1.5" stroke-linecap="round"/>
    <path class="xs-hair-b" d="M-9 -111 q3 -1.6 6 0 M3 -111 q3 -1.6 6 0" fill="none" stroke="#c24a24" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="0" cy="-102" r="1.7" fill="#e9a982"/>
    <ellipse class="xs-mouth" cx="0" cy="-95.6" rx="3.9" ry="3.3" fill="#5a1f24"/>
    <g class="xs-micset" transform="translate(14 -98.5) scale(1.3) translate(-14 98.5)"><rect class="xs-mic" x="11.5" y="-103.2" width="13.4" height="9.4" rx="4.7"/><rect class="xs-micband" x="18.6" y="-103.2" width="3.4" height="9.4"/>
      <circle class="xs-micg" cx="11.8" cy="-98.5" r="5.6"/><path class="xs-micmesh" d="M7 -98.5 H16.6 M11.8 -103.3 V-93.7 M8.4 -101.9 L15.2 -95.1 M15.2 -101.9 L8.4 -95.1"/></g>
    <g class="xs-arm-r"><path d="M14 -86 Q30 -85 28 -75.5" fill="none" stroke="#1f5a3f" stroke-width="8.4" stroke-linecap="round"/><circle cx="28" cy="-74.5" r="4.7" fill="#f2c29b"/></g>
  </g></g>`;

// Kleine Feuerwerke hinter Hügeln, Baum und Sänger (rein dekorativ; bei reduzierter Bewegung unsichtbar)
  const burst = (cx, cy, col, delay) => {
    let s = '';
    for (let k = 0; k < 12; k++) {
      const a = (Math.PI * 2 * k) / 12, c = Math.cos(a), si = Math.sin(a);
      s += `<line x1="${(c * 7).toFixed(1)}" y1="${(si * 7).toFixed(1)}" x2="${(c * 17).toFixed(1)}" y2="${(si * 17).toFixed(1)}" stroke="${col}"/><circle cx="${(c * 22).toFixed(1)}" cy="${(si * 22).toFixed(1)}" r="1.3" fill="${col}"/>`;
    }
    return `<g transform="translate(${cx} ${cy})"><g class="xs-fw" style="animation-delay:${delay}s">${s}</g></g>`;
  };
  const fireworks = burst(42, 22, '#ffd34d', 0) + burst(176, 4, '#7fd4ff', 1.4) + burst(216, 34, '#ff8fc9', 2.7) + burst(110, -4, '#b9ff9f', 3.5);

  return `<svg viewBox="0 -18 360 198" role="img" focusable="false" aria-hidden="true">
    <defs>
      <linearGradient id="xs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1633"/><stop offset=".7" stop-color="#26376a"/><stop offset="1" stop-color="#3b4f8a"/></linearGradient>
      <radialGradient id="xs-moon"><stop offset="0" stop-color="#fff7d6" stop-opacity=".9"/><stop offset="1" stop-color="#fff7d6" stop-opacity="0"/></radialGradient>
    </defs>
    <rect y="-18" width="360" height="198" fill="url(#xs-sky)"/>
    <g>${stars}</g>
    ${fireworks}
    <circle cx="322" cy="30" r="26" fill="url(#xs-moon)"/><circle cx="322" cy="30" r="12" fill="#fff4cf"/>
    <path d="M0 132 Q70 112 150 128 T300 122 T360 126 V180 H0Z" fill="#c9d8ee"/>
    <path d="M0 148 Q90 138 180 148 T360 146 V180 H0Z" fill="#eef4fc"/>
    ${band}${tree}${gifts}${singer}
    ${note(300, 52, 0, '#ffd34d')}${note(322, 70, 0.9, '#ff9ad5')}${note(296, 80, 1.7, '#9fd8ff')}${note(318, 44, 2.4, '#b9ff9f')}
    <g>${snow}</g>
  </svg>`;
}
