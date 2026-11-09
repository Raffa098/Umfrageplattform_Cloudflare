// Fragenkatalog (vorläufig / zu pilotieren). Reihenfolge, Texte und Skalen sind in allen Gruppen identisch.
// Änderungen hier = neue Experimentversion im Adminbereich vergeben.

const LIKELY = {
  de: ['Sehr unwahrscheinlich', 'Eher unwahrscheinlich', 'Teils / teils', 'Eher wahrscheinlich', 'Sehr wahrscheinlich'],
  en: ['Very unlikely', 'Rather unlikely', 'Neither / nor', 'Rather likely', 'Very likely'],
};
const AGREE = {
  de: ['Stimme gar nicht zu', 'Stimme eher nicht zu', 'Teils / teils', 'Stimme eher zu', 'Stimme voll zu'],
  en: ['Strongly disagree', 'Disagree', 'Neither / nor', 'Agree', 'Strongly agree'],
};
const FREQ = {
  de: ['Nie', 'Selten', 'Manchmal', 'Oft', 'Immer'],
  en: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
};

// type: rating | decision | consistency_a | consistency_b | comprehension | bogus
const RAW = [
  {
    id: 'Q01', type: 'rating', speeding: true,
    de: { text: 'Stell dir vor, du bekommst unerwartet 500 € geschenkt, zum Beispiel von Verwandten oder als Rückzahlung einer alten Forderung. Du könntest das Geld sofort für etwas ausgeben, das du dir schon länger wünschst, oder es für unvorhergesehene Ausgaben zurücklegen. Beides hätte Vor- und Nachteile. Wie wahrscheinlich ist es, dass du den größten Teil des Geldes sparst?', options: LIKELY.de },
    en: { text: 'Imagine unexpectedly receiving €500 as a gift, for example from relatives or as repayment of an old debt. You could spend the money immediately on something you have wanted for a long time, or set it aside for unexpected expenses. Both options have advantages and disadvantages. How likely are you to save most of the money?', options: LIKELY.en },
  },
  {
    id: 'Q02', type: 'rating', speeding: true,
    de: { text: 'Manche Menschen sagen, dass finanzielle Entscheidungen am besten gut geplant und mit Blick auf mehrere Jahre getroffen werden sollten, während andere sich lieber auf ihr Gefühl in der jeweiligen Situation verlassen. Beides kann je nach Anlass sinnvoll sein. Wenn du an deine größeren Ausgaben der letzten Monate denkst: Wie genau hast du diese im Voraus geplant?', options: ['Gar nicht geplant', 'Eher nicht geplant', 'Teils / teils', 'Eher geplant', 'Sehr genau geplant'] },
    en: { text: 'Some people believe financial decisions should be carefully planned with a view to the coming years, while others prefer to rely on how they feel in the moment. Either approach may make sense depending on the situation. Thinking about your larger purchases in recent months, how carefully did you plan them in advance?', options: ['Not at all', 'Rather little', 'Partly', 'Rather carefully', 'Very carefully'] },
  },
  {
    id: 'Q03', type: 'decision', speeding: true,
    de: { text: 'Du hast am Monatsende 100 € übrig. Es gibt keine unmittelbar fälligen Rechnungen, und du kannst frei entscheiden, ob du etwas kaufst oder Geld zurücklegst. Welchen Anteil der 100 € würdest du voraussichtlich sparen?', options: ['Nichts', 'Eher wenig', 'Etwa die Hälfte', 'Den Großteil', 'Alles'] },
    en: { text: 'At the end of the month, you have €100 left over. No bills are due immediately, and you can freely decide whether to buy something or set money aside. What share of the €100 would you most likely save?', options: ['Nothing', 'Rather little', 'About half', 'Most of it', 'All of it'] },
  },
  {
    id: 'Q04', type: 'rating', speeding: true,
    de: { text: 'Unerwartete Reparaturen oder zusätzliche Ausgaben können auch dann entstehen, wenn das monatliche Budget normalerweise ausreicht. Manche Menschen legen deshalb regelmäßig kleine Beträge zurück, andere entscheiden spontan. Wie gut fühlst du dich auf unerwartete Ausgaben vorbereitet?', options: ['Überhaupt nicht', 'Eher schlecht', 'Teils / teils', 'Eher gut', 'Sehr gut'] },
    en: { text: 'Unexpected repairs or extra expenses can occur even when the monthly budget is usually sufficient. Some people therefore set aside small amounts regularly, while others decide spontaneously. How well prepared do you feel for unexpected expenses?', options: ['Not at all', 'Rather poorly', 'Partly', 'Rather well', 'Very well'] },
  },
  {
    id: 'Q05', type: 'decision', speeding: true,
    de: { text: 'Angenommen, du möchtest dir etwas kaufen, das nicht dringend benötigt wird. Gleichzeitig könntest du mit demselben Betrag ein finanzielles Polster aufbauen. Wie wahrscheinlich würdest du den Kauf um mindestens einen Monat verschieben?', options: LIKELY.de },
    en: { text: 'Suppose you want to buy something you do not urgently need. You could also use the same amount to build up savings. How likely would you be to postpone the purchase for at least one month?', options: LIKELY.en },
  },
  {
    id: 'Q06', type: 'consistency_a', speeding: true,
    de: { text: 'Ich behalte bei meinen persönlichen Ausgaben im Allgemeinen den Überblick.', options: AGREE.de },
    en: { text: 'I generally keep track of my personal spending.', options: AGREE.en },
  },
  {
    id: 'Q07', type: 'decision', speeding: true,
    de: { text: 'Ein gebrauchtes Gerät kostet weniger als ein neues. Das neue Gerät hat dagegen eine längere Garantie, und du weißt nicht genau, welche zusätzlichen Kosten später entstehen könnten. Wie wahrscheinlich würdest du vor einer Entscheidung beide Gesamtkosten vergleichen?', options: LIKELY.de },
    en: { text: 'A used device costs less than a new one. The new device, however, has a longer warranty, and you do not know what additional costs might arise later. How likely would you be to compare the total costs of both options before deciding?', options: LIKELY.en },
  },
  {
    id: 'Q08', type: 'rating', speeding: true,
    de: { text: 'Manche Zahlungen fallen nur selten an und werden deshalb im Monatsbudget leicht übersehen. Andere Menschen planen solche Kosten frühzeitig ein. Wie regelmäßig berücksichtigst du unregelmäßige Ausgaben bei deiner finanziellen Planung?', options: FREQ.de },
    en: { text: 'Some payments occur infrequently and can easily be overlooked in a monthly budget. Other people plan for these costs well in advance. How regularly do you consider irregular expenses in your financial planning?', options: FREQ.en },
  },
  {
    id: 'Q09', type: 'comprehension', speeding: false, correct: ['A'],
    de: {
      passage: 'Eine Bank vergibt einen Kredit nur dann, wenn das Einkommen gesichert ist und keine offenen Schulden bestehen. Ben hat einen Kredit bekommen. Clara hat offene Schulden.',
      text: 'Welche Aussage folgt sicher aus dem Text?',
      options: ['Ben hat keine offenen Schulden.', 'Clara hat einen Kredit bekommen.', 'Ben hat ein hohes Einkommen.', 'Clara hat kein gesichertes Einkommen.'],
    },
    en: {
      passage: 'A bank grants a loan only if the applicant has a secure income and no outstanding debts. Ben received a loan. Clara has outstanding debts.',
      text: 'Which statement necessarily follows from the text?',
      options: ['Ben has no outstanding debts.', 'Clara received a loan.', 'Ben has a high income.', 'Clara has no secure income.'],
    },
  },
  {
    id: 'Q10', type: 'consistency_b', speeding: true,
    de: { text: 'Ich verliere bei meinen persönlichen Ausgaben häufig den Überblick.', options: AGREE.de },
    en: { text: 'I often lose track of my personal spending.', options: AGREE.en },
  },
  {
    id: 'Q11', type: 'decision', speeding: true,
    de: { text: 'Du erhältst zwei Angebote für denselben Gegenstand. Beim ersten Angebot ist der angezeigte Preis niedriger, allerdings kommen Versandkosten und eine zusätzliche Gebühr hinzu. Beim zweiten Angebot ist der Preis höher, aber alle Kosten sind bereits enthalten. Wie wahrscheinlich würdest du vor der Auswahl die gesamten Endpreise vergleichen?', options: LIKELY.de },
    en: { text: 'You receive two offers for the same item. The first shows a lower price, but shipping costs and an additional fee apply. The second has a higher listed price, but all charges are included. How likely would you be to compare the final total prices before choosing?', options: LIKELY.en },
  },
  {
    id: 'Q12', type: 'rating', speeding: true,
    de: { text: 'Bei wiederkehrenden Ausgaben wie Abonnements, Mobilfunkverträgen oder Mitgliedschaften entstehen über mehrere Monate teilweise erhebliche Beträge. Solche Abbuchungen fallen im Alltag oft weniger auf als einzelne größere Käufe. Wie sorgfältig überprüfst du, ob du deine laufenden Verträge noch benötigst?', options: ['Gar nicht', 'Eher selten', 'Teils / teils', 'Eher sorgfältig', 'Sehr sorgfältig'] },
    en: { text: 'Recurring expenses such as subscriptions, phone contracts or memberships can add up to significant amounts over several months. Such payments are often less noticeable in everyday life than one large purchase. How carefully do you check whether you still need your ongoing contracts?', options: ['Not at all', 'Rather rarely', 'Partly', 'Rather carefully', 'Very carefully'] },
  },
  {
    id: 'Q13', type: 'decision', speeding: true,
    de: { text: 'Stell dir vor, du planst einen größeren Kauf für das kommende Halbjahr. Der Preis könnte sich verändern, gleichzeitig weißt du noch nicht genau, wie viel Geld dir bis dahin zur Verfügung stehen wird. Du könntest sofort bestellen oder zunächst mehr Informationen sammeln. Wie wahrscheinlich würdest du vor der Bestellung noch einmal dein Budget prüfen?', options: LIKELY.de },
    en: { text: 'Imagine planning a larger purchase within the next six months. The price might change, and you do not yet know exactly how much money you will have available. You could order immediately or gather more information first. How likely would you be to check your budget again before ordering?', options: LIKELY.en },
  },
  {
    id: 'Q14', type: 'bogus', speeding: false, correct: ['4', '5'],
    de: { text: 'Ein Euro besteht aus 100 Cent.', options: AGREE.de },
    en: { text: 'One euro consists of 100 cents.', options: AGREE.en },
  },
  {
    id: 'Q15', type: 'rating', speeding: true,
    de: { text: 'Wenn mehrere finanzielle Entscheidungen kurz hintereinander getroffen werden müssen, ist es nicht immer leicht, sämtliche Informationen zu beachten. Manche Menschen verlassen sich auf ihre erste Einschätzung, andere sehen sich mögliche Folgen noch einmal in Ruhe an. Wie häufig nimmst du dir bei größeren Ausgaben bewusst Zeit, um verschiedene Alternativen abzuwägen?', options: FREQ.de },
    en: { text: 'When several financial decisions must be made in quick succession, it is not always easy to consider all available information. Some people rely on their first impression, while others calmly review the possible consequences again. How often do you deliberately take time to weigh alternatives before making larger purchases?', options: FREQ.en },
  },
];

// Wörter = Tokens mit mindestens einem Buchstaben oder einer Ziffer ("€" allein zählt nicht)
const countWords = (s) => (s || '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

// words = Passage + Fragetext; words_opt = zusätzlich inklusive aller Antwortoptionen (Pflichtenheft: Speeding-Schwelle "inklusive Antwortoptionen").
// Welche Variante für das Speeding-Flag gilt, steht in der Konfiguration (word_count_mode).
const wordCounts = (it) => {
  const w = (l) => countWords(it[l].passage) + countWords(it[l].text);
  const o = (l) => countWords((it[l].options || []).join(' '));
  return { words: { de: w('de'), en: w('en') }, words_opt: { de: w('de') + o('de'), en: w('en') + o('en') } };
};

export const ITEMS = RAW.map((it, i) => ({
  ...it,
  position: i + 1,
  block: Math.floor(i / 5) + 1,
  ...wordCounts(it),
}));
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((it) => [it.id, it]));
export const TOTAL = ITEMS.length;
export const ROLES = { consistencyA: 'Q06', consistencyB: 'Q10', comprehension: 'Q09', bogus: 'Q14' };

// Texte können im Adminbereich überschrieben werden (nur text / passage / options; Typ, Reihenfolge und Messrolle bleiben fest)
export function effectiveItems(overrides = {}) {
  return ITEMS.map((it) => {
    const o = overrides[it.id];
    if (!o) return it;
    const out = { ...it, de: { ...it.de, ...(o.de || {}) }, en: { ...it.en, ...(o.en || {}) } };
    Object.assign(out, wordCounts(out));
    return out;
  });
}

// Was der Browser sieht: keine Messrollen, keine richtigen Antworten
export const publicItems = (lang, overrides) =>
  effectiveItems(overrides).map((it) => ({
    id: it.id,
    position: it.position,
    block: it.block,
    kind: it.type === 'comprehension' ? 'choice' : 'likert',
    passage: it[lang].passage || null,
    text: it[lang].text,
    options: it[lang].options,
  }));
