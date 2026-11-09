// Vorläufige Zusatzfragen (nicht validiert, im Adminbereich editierbar).
// section: 'manipulation' (direkt nach den 15 Hauptfragen, gleiche Items für alle Gruppen) | 'control' (Pflicht)
//          | 'feedback' (letzte Seite vor dem Abschluss: Smiley-Bewertung, im Admin ein-/ausschaltbar)
// kind: 'choice' (Optionen, Wert = 1..n) | 'number' (ganze Zahl min..max) | 'smiley' (5 Gesichter, Wert 1..5)
// ordinal: Mittelwert im Dashboard sinnvoll (z. B. 5-Punkte-Zustimmung)

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
  scale('M1', 'manipulation',
    'Ich wusste während der Umfrage jederzeit, wie weit ich schon gekommen war.',
    'During the survey I always knew how far along I was.', true),
  scale('M2', 'manipulation',
    'Die Umfrage hatte spielerische Elemente (z. B. eine Reise mit Etappen).',
    'The survey had playful elements (e.g. a journey with stages).', true),
  scale('M3', 'manipulation',
    'Ich habe während der Umfrage motivierende Hinweise oder Ermutigungen gesehen.',
    'During the survey I saw motivating notes or words of encouragement.', true),
  scale('M4', 'manipulation',
    'Die Gestaltung der Umfrage hat mich motiviert, die Fragen sorgfältig zu lesen.',
    'The design of the survey motivated me to read the questions carefully.', true),
  {
    id: 'C1', section: 'control', kind: 'choice', required: true, visible: true, ordinal: false, groups: ALL_GROUPS,
    de: { text: 'Wie oft nimmst du an Online-Umfragen teil?', options: ['Heute zum ersten Mal', 'Selten (weniger als einmal im Monat)', 'Mehrmals im Monat', 'Mehrmals pro Woche'] },
    en: { text: 'How often do you take part in online surveys?', options: ['This is my first time', 'Rarely (less than once a month)', 'A few times a month', 'A few times a week'] },
  },
  {
    id: 'C2', section: 'control', kind: 'number', min: 0, max: 40, required: true, visible: true, ordinal: true, groups: ALL_GROUPS,
    de: { text: 'In welchem Fachsemester bist du? (0 = ich studiere nicht)', options: [] },
    en: { text: 'Which semester of your degree are you in? (0 = I am not studying)', options: [] },
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
    de: { text: 'Wie hat Ihnen diese Umfrage gefallen?', options: ['Gar nicht gut', 'Eher nicht gut', 'Geht so', 'Eher gut', 'Sehr gut'] },
    en: { text: 'How did you like this survey?', options: ['Not at all', 'Not really', 'So-so', 'Quite good', 'Very good'] },
  },
];
