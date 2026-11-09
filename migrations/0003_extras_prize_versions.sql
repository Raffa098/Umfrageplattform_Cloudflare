-- Manipulationschecks + Kontrollfragen, getrennte Gewinnspiel-Codes, Konfigurationsversionen.

-- Antworten auf Zusatzfragen (Manipulationschecks / Kontrollvariablen)
CREATE TABLE extra_answers (
  participant_id TEXT NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  item_id        TEXT NOT NULL,
  value          TEXT NOT NULL,          -- '' = freiwillig übersprungen
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (participant_id, item_id)
);

-- Gewinnspiel-Codes: bewusst OHNE Verweis auf participants und nur mit Datum (kein Zeitstempel),
-- damit keine dauerhafte Zuordnung Code -> Antworten gespeichert wird.
CREATE TABLE prize_codes (
  code    TEXT PRIMARY KEY,
  day     TEXT NOT NULL,
  is_test INTEGER NOT NULL DEFAULT 0
);

-- Dokumentierte Experimentversionen: Snapshot der Konfiguration beim ersten echten Teilnehmenden
CREATE TABLE config_versions (
  version      TEXT PRIMARY KEY,
  snapshot     TEXT NOT NULL,
  catalog_hash TEXT NOT NULL,
  frozen_at    TEXT NOT NULL
);

ALTER TABLE participants ADD COLUMN main_completed_at TEXT;  -- nach Q15
UPDATE participants SET main_completed_at = completed_at WHERE completed_at IS NOT NULL;

-- completed_at = vollständig fertig inkl. Zusatzfragen; der Code hängt nicht mehr an der Person
ALTER TABLE participants DROP COLUMN completion_code;
