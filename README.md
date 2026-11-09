# Umfrageplattform – Experiment Antwortqualität

Mobile-first Web-App für das Experiment „Verbessern Fortschrittsreise oder einmalige Motivationsimpulse die Antwortqualität?“
Cloudflare Workers (API + statische App) mit Cloudflare D1 als Datenbank.

- **Umfrage:** https://anonymsurvey.rasa-215.workers.dev
- **Adminbereich:** https://anonymsurvey.rasa-215.workers.dev/admin/ (Schlüssel = Secret `ADMIN_TOKEN`, lokal in `.dev.vars`)

## Ablauf für Teilnehmende
Sprachwahl (DE/EN) → Einwilligung → serverseitige Zuteilung 1:1:1 → 15 Fragen in fester Reihenfolge → Abschlusscode.

| Gruppe | Was anders ist |
|---|---|
| Kontrolle | neutraler Kopfbereich |
| Gamification | animierte Reise Wald → Stadt → Universität ab Q1, ein Schritt pro beantworteter Frage, Etappen bei 5/10/15 |
| Motivation | neutraler Kopfbereich + einmalige Hinweisseiten vor Q1, nach Q5, nach Q10 |

## Messung
- Antwortzeit: ab vollständiger Darstellung der Frage bis „Weiter“ (Animationen und Zwischenseiten zählen nicht mit), Hintergrundzeit separat (`hidden_ms`)
- Speeding: `rt_ms < Faktor × Wörter` (13 Fragen, ohne Q9/Q14), Faktor je Sprache im Admin einstellbar
- Consistency Q6/Q10 · Comprehension Q9 (richtig: A) · Bogus Q14 (richtig: 4 oder 5)
- Indikatoren werden aus den Rohdaten berechnet, Regeln ändern nie die gespeicherten Daten

## Nach den 15 Fragen
1. **Manipulationschecks** (M1–M4, gleiche Items für alle Gruppen) und 2. **Kontrollfragen** (C1–C4: Teilnahmehäufigkeit, Fachsemester, Teilnahmegrund, Gewinnchance).
Alles im Admin editierbar (Text, Skala, Reihenfolge, Pflicht, Sichtbarkeit, Gruppen, DE/EN). Der Katalog ist **vorläufig und nicht validiert**.

## Abschluss & Gewinnspiel
Der Abschlusscode wird auf dem Gerät erzeugt und **ohne Verweis auf Antworten** gespeichert (`prize_codes`, nur Datum).
Es wird keine E-Mail-Adresse abgefragt; Teilnehmende schreiben selbst an die im Admin hinterlegte Adresse.
Datenschutz, Löschfristen und Teilnahmebedingungen müssen rechtlich geprüft werden – die Plattform garantiert keine DSGVO-Konformität.

## Testmodus
Nur im Admin (Tab „Testmodus“): Gruppe wählbar oder Zufall, Start bei Q1/Q6/Q11/Q15. Öffentlich gibt es keine Gruppenwahl.
Testdaten sind markiert und standardmäßig aus Übersicht und Export ausgeschlossen.

## Versionen & Sperre
Beim ersten echten Teilnehmenden wird die Konfiguration als Snapshot dokumentiert (`config_versions`). Danach sind Motivationstexte,
Fragentexte, Zusatzfragen und Reise-Animation gesperrt – Änderungen nur mit neuer Experimentversion.

## Links für Umfrage-Plattformen
`?lang=de` / `?lang=en` überspringt die Sprachwahl, `?src=name` speichert die Herkunft.
Optional im Admin eine Rücksprung-URL mit `{code}` hinterlegen.

## Entwicklung
```
npm install
npm run db:migrate:local
npm run dev              # http://localhost:8787 und /admin/
npm run db:migrate:remote
npm run deploy
```
Migrationen immer zuerst lokal testen; produktiv (`db:migrate:remote`, `deploy`) nur nach Freigabe.

## Struktur
- `src/index.js` – API (Sitzung, Antworten, Ereignisse, Admin, Export)
- `src/catalog.js` – Fragenkatalog DE/EN (Änderungen → neue Experimentversion)
- `public/` – Teilnehmer-App (`js/app.js`, `js/journey.js`, `css/app.css`) und `admin/`
- `migrations/` – Datenbankschema
