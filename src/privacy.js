// Vorlage der Datenschutzerklärung (DSGVO) für die Teilnehmenden. Im Adminbereich bearbeitbar.
// WICHTIG: Das ist eine fachlich/rechtlich NICHT geprüfte Vorlage. Stellen in [eckigen Klammern] sind Platzhalter und
// müssen von der verantwortlichen Stelle ausgefüllt werden, bevor echte Teilnahmen erhoben werden.
// Format: "## Überschrift", Absätze durch Leerzeilen, Aufzählungen mit "- ".

export const DEFAULT_PRIVACY = {
  de: `## 1. Worum geht es?
Diese Umfrage ist Teil eines wissenschaftlichen Online-Experiments zur Qualität von Antworten in Online-Umfragen. Die Teilnahme ist freiwillig. Diese Erklärung informiert dich darüber, welche Daten verarbeitet werden und welche Rechte du nach der Datenschutz-Grundverordnung (DSGVO) hast.

## 2. Verantwortliche Stelle
[Name der Hochschule / Einrichtung und der verantwortlichen Studienleitung]

[Anschrift]

Kontakt: [E-Mail-Adresse der Studienleitung]

Datenschutzbeauftragte(r): [Kontaktdaten der oder des Datenschutzbeauftragten]

## 3. Welche Daten werden erhoben?
In der Umfrage selbst erheben wir keine Namen, E-Mail-Adressen oder andere Angaben, mit denen wir dich direkt identifizieren könnten. Gespeichert werden:
- deine Antworten auf die Umfragefragen (einschließlich der Zusatzfragen am Ende),
- die Zeit, die du für jede Frage benötigt hast, sowie der Zeitpunkt der Teilnahme,
- die dir zufällig zugeteilte Versuchsgruppe und die gewählte Sprache,
- grobe technische Angaben (z. B. Handy oder Computer, Bildschirmgröße, helles oder dunkles Farbschema, Einstellung „Bewegung reduzieren“),
- technische Ereignisse, die für den Ablauf nötig sind (z. B. ob die Seite im Hintergrund war oder ob das Speichern fehlgeschlagen ist),
- eine zufällige Teilnahme-ID. Sie dient nur dazu, deine Antworten innerhalb der Umfrage zusammenzuhalten und enthält keine Informationen über dich.

Von uns nicht gespeichert werden: deine IP-Adresse, die vollständige Browserkennung (User-Agent), Standortdaten sowie Cookies zu Werbe- oder Analysezwecken.

## 4. Zwecke und Rechtsgrundlage
Die Daten werden ausschließlich für die wissenschaftliche Auswertung dieses Experiments verwendet. Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du zu Beginn der Umfrage erteilst. [Gegebenenfalls weitere Rechtsgrundlage für wissenschaftliche Forschung ergänzen.]

## 5. Technischer Betrieb und Hosting
Die Umfrage wird über die Plattform Cloudflare (Cloudflare Workers und die Datenbank Cloudflare D1) betrieben. Beim Aufruf der Seite verarbeitet der Hosting-Anbieter technisch notwendige Verbindungsdaten (z. B. die IP-Adresse), um die Seite auszuliefern und abzusichern. Wir selbst speichern diese Daten nicht in unserer Umfragedatenbank und werten sie nicht aus. [Auftragsverarbeitungsvertrag, Datenstandort und eine mögliche Übermittlung in Drittländer prüfen und hier beschreiben.]

## 6. Speicherung im Browser
Damit du nach einem Neuladen an derselben Stelle weitermachen kannst, speichert die Umfrage in deinem Browser (Local Storage) deine Sitzungs-ID, die Sprache, den Fortschritt und – falls du sie einstellst – dein Farbschema sowie die Einstellung „Bewegung reduzieren“. Es werden keine Tracking-Cookies verwendet. Du kannst diese Daten jederzeit über die Einstellungen deines Browsers löschen.

## 7. Freiwilliges Gewinnspiel
Nach Abschluss erhältst du einen zufälligen Teilnahme-Code. Wenn du am Gewinnspiel teilnehmen möchtest, schreibst du uns freiwillig selbst eine E-Mail mit diesem Code an die angegebene Kontaktadresse. Dabei verarbeiten wir deine E-Mail-Adresse und den Code ausschließlich, um das Gewinnspiel durchzuführen. Der Code wird getrennt von deinen Umfrageantworten gespeichert; wir ordnen ihn deinen Antworten nicht zu. [Zweck, Rechtsgrundlage, Löschfrist und Teilnahmebedingungen für die E-Mail-Verarbeitung ergänzen.]

## 8. Speicherdauer
[Speicherdauer der Umfragedaten festlegen und hier angeben.] E-Mails und Codes des Gewinnspiels löschen wir [Frist ergänzen] nach Ende des Gewinnspiels.

## 9. Weitergabe
Eine Weitergabe der Rohdaten an Dritte findet nicht statt. Ergebnisse werden nur zusammengefasst veröffentlicht, sodass keine Rückschlüsse auf einzelne Personen möglich sind. [Gegebenenfalls ergänzen, falls Daten für Replikationszwecke bereitgestellt werden.]

## 10. Deine Rechte
Du hast nach der DSGVO das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) sowie das Recht, eine erteilte Einwilligung jederzeit mit Wirkung für die Zukunft zu widerrufen (Art. 7 Abs. 3).

Da die Umfrageantworten nicht mit deiner Person verknüpft sind, können wir einzelne Antworten nach Abschluss der Umfrage deiner Person nicht mehr zuordnen und deshalb auch nicht nachträglich löschen oder herausgeben. Die Teilnahme kannst du jederzeit abbrechen, indem du die Seite schließt. Für die E-Mail-Kommunikation zum Gewinnspiel kannst du deine Rechte uns gegenüber geltend machen.

Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. [Zuständige Aufsichtsbehörde ergänzen.]`,

  en: `## 1. What is this about?
This survey is part of a scientific online experiment on the quality of responses in online surveys. Participation is voluntary. This notice tells you which data are processed and which rights you have under the General Data Protection Regulation (GDPR).

## 2. Controller
[Name of the university / institution and the responsible study lead]

[Address]

Contact: [e-mail address of the study lead]

Data protection officer: [contact details of the data protection officer]

## 3. Which data are collected?
In the survey itself we do not collect names, e-mail addresses or any other details that would let us identify you directly. We store:
- your answers to the survey questions (including the additional questions at the end),
- the time you needed for each question and the time of participation,
- the experimental group randomly assigned to you and the language you chose,
- coarse technical details (e.g. phone or computer, screen size, light or dark colour scheme, the “reduce motion” setting),
- technical events needed for the procedure (e.g. whether the page was in the background or saving failed),
- a random participation ID. It only keeps your answers together within the survey and contains no information about you.

We do not store: your IP address, the full browser identifier (user agent), location data, or cookies for advertising or analytics.

## 4. Purposes and legal basis
The data are used exclusively for the scientific analysis of this experiment. The legal basis is your consent (Art. 6(1)(a) GDPR), which you give at the start of the survey. [Add further legal basis for scientific research where applicable.]

## 5. Technical operation and hosting
The survey is operated via the Cloudflare platform (Cloudflare Workers and the Cloudflare D1 database). When you open the page, the hosting provider processes technically necessary connection data (e.g. the IP address) in order to deliver and secure the page. We ourselves do not store these data in our survey database and do not analyse them. [Check the data processing agreement, data location and any transfer to third countries and describe them here.]

## 6. Storage in your browser
So that you can continue where you left off after a reload, the survey stores your session ID, language, progress and – if you set them – your colour scheme and the “reduce motion” setting in your browser (Local Storage). No tracking cookies are used. You can delete these data at any time in your browser settings.

## 7. Voluntary prize draw
After completing the survey you receive a random participation code. If you want to take part in the prize draw, you voluntarily send us an e-mail with this code to the contact address given. We process your e-mail address and the code solely to run the prize draw. The code is stored separately from your survey answers; we do not link it to your answers. [Add purpose, legal basis, retention period and terms of participation for the e-mail processing.]

## 8. Retention
[Define and state the retention period of the survey data.] We delete e-mails and prize-draw codes [add period] after the prize draw has ended.

## 9. Disclosure
Raw data are not passed on to third parties. Results are published only in aggregated form so that no conclusions about individuals can be drawn. [Add if data are made available for replication purposes.]

## 10. Your rights
Under the GDPR you have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and objection (Art. 21), as well as the right to withdraw consent at any time with effect for the future (Art. 7(3)).

Because the survey answers are not linked to you, we can no longer attribute individual answers to you after the survey is completed and therefore cannot delete or release them afterwards. You can stop at any time by closing the page. For the e-mail communication about the prize draw you can exercise your rights against us.

You also have the right to lodge a complaint with a data protection supervisory authority. [Add the competent supervisory authority.]`,
};
