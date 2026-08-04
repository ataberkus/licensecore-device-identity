-- SQLite init migration for @licensecore/server
-- Candidate indexes: (asn, created_at), (stable_hash_prefix, created_at)
-- Phase-2 placeholders (do NOT create): license_seats, products, users

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY NOT NULL,
  confidence TEXT NOT NULL,
  spoof_score INTEGER NOT NULL DEFAULT 0,
  hardware_backed INTEGER NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  retired_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS device_anchors (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(id),
  tier INTEGER NOT NULL,
  key_id TEXT NOT NULL,
  public_key_spki TEXT,
  aaguid TEXT,
  be_flag INTEGER,
  bs_flag INTEGER,
  sign_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS device_anchors_key_id_uidx ON device_anchors(key_id);

CREATE TABLE IF NOT EXISTS device_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(id),
  revision INTEGER NOT NULL,
  stable_hash TEXT NOT NULL,
  stable_hash_prefix TEXT NOT NULL,
  volatile_hash TEXT NOT NULL,
  component_hashes TEXT NOT NULL,
  integrity TEXT NOT NULL,
  server_signals TEXT NOT NULL,
  asn INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS device_evidence_asn_created_idx ON device_evidence(asn, created_at);
CREATE INDEX IF NOT EXISTS device_evidence_prefix_created_idx ON device_evidence(stable_hash_prefix, created_at);
CREATE INDEX IF NOT EXISTS device_evidence_device_rev_idx ON device_evidence(device_id, revision);

CREATE TABLE IF NOT EXISTS device_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  device_id TEXT REFERENCES devices(id),
  type TEXT NOT NULL,
  payload TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS device_events_device_created_idx ON device_events(device_id, created_at);
CREATE INDEX IF NOT EXISTS device_events_type_created_idx ON device_events(type, created_at);

CREATE TABLE IF NOT EXISTS device_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  device_id TEXT NOT NULL REFERENCES devices(id),
  related_device_id TEXT NOT NULL REFERENCES devices(id),
  relation TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS device_links_device_idx ON device_links(device_id);
