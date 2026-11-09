-- Experiment-Schema: ersetzt das generische Umfrage-Schema aus 0001 (Tabellen waren leer).
DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS responses;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS surveys;

-- Eine Zeile pro Teilnahme (Personenebene)
CREATE TABLE participants (
  id              TEXT PRIMARY KEY,                -- zufällige UUID, zugleich Sitzungs-Token
  grp             TEXT NOT NULL CHECK (grp IN ('control', 'gamification', 'motivation')),
  lang            TEXT NOT NULL CHECK (lang IN ('de', 'en')),
  version         TEXT NOT NULL,                   -- Experimentversion zum Zeitpunkt der Teilnahme
  is_test         INTEGER NOT NULL DEFAULT 0,
  consent_at      TEXT NOT NULL,
  source          TEXT,                            -- z. B. ?src=surveycircle
  completion_code TEXT NOT NULL,
  device_mobile   INTEGER,
  viewport_w      INTEGER,
  viewport_h      INTEGER,
  dark_mode       INTEGER,
  reduced_motion  INTEGER,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at    TEXT,
  completed_at    TEXT
);
CREATE INDEX idx_participants_version ON participants (version, is_test, grp);

-- Rohdaten: Person × Frage
CREATE TABLE responses (
  participant_id TEXT NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  item_id        TEXT NOT NULL,
  position       INTEGER NOT NULL,
  block          INTEGER NOT NULL,
  value          TEXT NOT NULL,
  rt_ms          INTEGER NOT NULL,   -- vollständig sichtbar -> Klick auf "Weiter"
  first_click_ms INTEGER,            -- vollständig sichtbar -> erste Auswahl
  hidden_ms      INTEGER NOT NULL DEFAULT 0,  -- Zeit, in der der Tab im Hintergrund war
  changes        INTEGER NOT NULL DEFAULT 0,  -- Anzahl Antwortwechsel
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (participant_id, item_id)
);

-- Verlauf: Frage sichtbar, Pausen, Zwischenseiten, Abschluss …
CREATE TABLE events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id TEXT NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  type           TEXT NOT NULL,
  item_id        TEXT,
  client_ts      INTEGER,
  data           TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_events_participant ON events (participant_id);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  action     TEXT NOT NULL,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
