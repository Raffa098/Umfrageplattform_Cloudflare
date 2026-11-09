// Vorläufige Zusatzfragen (nicht validiert, im Adminbereich editierbar).
// section: 'manipulation' (direkt nach den 15 Hauptfragen, gleiche Items für alle Gruppen) | 'control' (Pflicht)
//          | 'feedback' (letzte Seite vor dem Abschluss: Smiley-Bewertung, im Admin ein-/ausschaltbar)
// kind: 'choice' (Optionen, Wert = 1..n) | 'number' (ganze Zahl min..max) | 'smiley' (5 Gesichter, Wert 1..5)
// ordinal: Mittelwert im Dashboard sinnvoll (z. B. 5-Punkte-Zustimmung)
// multi: Mehrfachauswahl (Checkboxen), Antwort = Optionsnummern mit | verbunden (z. B. "1|3")
// show_if: { item, max?, min? } – Frage erscheint nur, wenn die Antwort auf 'item' <= max bzw. >= min ist (Nachfragen zu den Smileys)

export const SECTIONS = ['manipulation', 'control', 'feedback'];
export const ALL_GROUPS = ['control', 'gamification', 'motivation'];

const AGREE = {
  de: ['Stimme gar nicht zu', 'Stimme eher nicht zu', 'Teils / teils', 'Stimme eher zu', 'Stimme voll zu'],
  en: ['Strongly disagree', 'Disagree', 'Neither / nor', 'Agree', 'Strongly agree'],
};

const scale = (id, section, de, en, required) => ({
  id, section, kind: 'choice', required, visible: true, ordinal: true, groups: ALL_GROUPS,
  de: { text: de, options: AGREE.de },
  en: { text: en, options: AGREE.en },
});

export const DEFAULT_EXTRAS = [
  // Ein einziger, einfacher Check: nennt die eigene Erfahrung. Je eine Aussage für Gamification und Motivation (nicht verwechselbar,
  // ohne Begriffe der jeweils anderen Gruppe) plus eine neutrale Antwort, die man mit keiner der beiden Bedingungen verbindet.
  // Kodierung: 1 = Gamification-Aussage, 2 = Motivations-Aussage, 3 = neutral
  {
    id: 'M1', section: 'manipulation', kind: 'choice', required: true, visible: true, ordinal: false, groups: ALL_GROUPS,
    de: { text: 'Was trifft auf deine Erfahrung in dieser Umfrage am ehesten zu?', options: [
      'Ich habe während der Umfrage eine akademische Laufbahn durchlebt und Punkte gesammelt.',
      'Ich wurde zwischendurch mit Worten ermutigt, die Fragen sorgfältig zu beantworten.',
      'Weder noch: Es gab nur die Fragen, ohne weitere Besonderheiten.'] },
    en: { text: 'Which of these best describes your experience in this survey?', options: [
      'During the survey I went through an academic career and collected points.',
      'In between, I was encouraged with words to answer the questions carefully.',
      'Neither: there were only the questions, nothing else.'] },
  },
  {
    id: 'C1', section: 'control', kind: 'choice', required: true, visible: true, ordinal: false, groups: ALL_GROUPS,
    de: { text: 'Wie oft nimmst du an Online-Umfragen teil?', options: ['Heute zum ersten Mal', 'Selten (weniger als einmal im Monat)', 'Mehrmals im Monat', 'Mehrmals pro Woche'] },
    en: { text: 'How often do you take part in online surveys?', options: ['This is my first time', 'Rarely (less than once a month)', 'A few times a month', 'A few times a week'] },
  },
  {
    id: 'C2', section: 'control', kind: 'choice', required: true, visible: true, ordinal: false, groups: ALL_GROUPS,
    de: { text: 'In welchem Fachsemester bist du?', options: ['1–2', '3–4', '5–6', '7+ (oder Master)'] },
    en: { text: 'Which semester of your degree are you in?', options: ['1–2', '3–4', '5–6', '7+ (or Master)'] },
  },
  {
    id: 'C3', section: 'control', kind: 'choice', required: true, visible: true, ordinal: false, groups: ALL_GROUPS,
    de: { text: 'Was war dein wichtigster Grund, an dieser Umfrage teilzunehmen?', options: ['Interesse am Thema', 'Forschung unterstützen', 'Gewinnchance / Belohnung', 'Anforderung im Studium oder Kurs', 'Sonstiges'] },
    en: { text: 'What was your main reason for taking part in this survey?', options: ['Interest in the topic', 'Supporting research', 'Chance to win / reward', 'Course or study requirement', 'Other'] },
  },
  scale('C4', 'control',
    'Ich habe vor allem wegen der Gewinnchance (Mystery-Box) teilgenommen.',
    'I mainly took part because of the chance to win (mystery box).', true),
  // Letzte Seite vor dem Abschluss: Smiley-Bewertung (Pflicht = aus, im Admin änderbar; Sichtbar = aus blendet die Seite aus)
  {
    id: 'F1', section: 'feedback', kind: 'smiley', required: false, visible: true, ordinal: true, groups: ALL_GROUPS,
    de: { text: 'Wie hat dir diese Umfrage gefallen?', options: ['Gar nicht gut', 'Eher nicht gut', 'Geht so', 'Eher gut', 'Sehr gut'] },
    en: { text: 'How did you like this survey?', options: ['Not at all', 'Not really', 'So-so', 'Quite good', 'Very good'] },
  },
  // Nachfrage nur bei den zwei schlechtesten Smileys (show_if max 2): was hat nicht gefallen? Bei den zwei besten: F3. Bei "Geht so": keine Nachfrage.
  {
    id: 'F2', section: 'feedback', kind: 'choice', multi: true, required: false, visible: true, ordinal: false, groups: ALL_GROUPS, show_if: { item: 'F1', max: 2 },
    de: { text: 'Was hat dir vor allem nicht gefallen?', options: ['Das Design', 'Die Fragen waren zu lang', 'Die Fragen waren schwer zu verstehen', 'Die Umfrage erschien mir sinnlos', 'Es hat zu lange gedauert', 'Technische Probleme', 'Etwas anderes'] },
    en: { text: 'What did you mainly dislike?', options: ['The design', 'The questions were too long', 'The questions were hard to understand', 'The survey seemed pointless', 'It took too long', 'Technical problems', 'Something else'] },
  },
  // Nachfrage nur bei den zwei besten Smileys (show_if min 4): was hat besonders gefallen?
  {
    id: 'F3', section: 'feedback', kind: 'choice', multi: true, required: false, visible: true, ordinal: false, groups: ALL_GROUPS, show_if: { item: 'F1', min: 4 },
    de: { text: 'Was hat dir besonders gut gefallen?', options: ['Das Design', 'Die Fragen waren interessant', 'Die Fragen waren gut verständlich', 'Die Länge war genau richtig', 'Der Ablauf war abwechslungsreich', 'Die Umfrage erschien mir sinnvoll', 'Etwas anderes'] },
    en: { text: 'What did you particularly like?', options: ['The design', 'The questions were interesting', 'The questions were easy to understand', 'The length was just right', 'The flow was varied', 'The survey seemed worthwhile', 'Something else'] },
  },
];
