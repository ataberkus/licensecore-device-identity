-- Postgres 16 init migration for @licensecore/server
-- Candidate indexes: (asn, created_at), (stable_hash_prefix, created_at)
-- Phase-2 placeholders (do NOT create): license_seats, products, users

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY NOT NULL,
  confidence TEXT NOT NULL,
  spoof_score INTEGER NOT NULL DEFAULT 0,
  hardware_backed BOOLEAN NOT NULL DEFAULT FALSE,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  retired_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_anchors (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  tier INTEGER NOT NULL,
  key_id TEXT NOT NULL,
  public_key_spki TEXT,
  aaguid TEXT,
  be_flag BOOLEAN,
  bs_flag BOOLEAN,
  sign_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS device_anchors_key_id_uidx ON device_anchors(key_id);

CREATE TABLE IF NOT EXISTS device_evidence (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  revision INTEGER NOT NULL,
  stable_hash TEXT NOT NULL,
  stable_hash_prefix TEXT NOT NULL,
  volatile_hash TEXT NOT NULL,
  component_hashes JSONB NOT NULL,
  integrity JSONB NOT NULL,
  server_signals JSONB NOT NULL,
  asn INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_evidence_asn_created_idx ON device_evidence(asn, created_at);
CREATE INDEX IF NOT EXISTS device_evidence_prefix_created_idx ON device_evidence(stable_hash_prefix, created_at);
CREATE INDEX IF NOT EXISTS device_evidence_device_rev_idx ON device_evidence(device_id, revision);

CREATE TABLE IF NOT EXISTS device_events (
  id SERIAL PRIMARY KEY,
  device_id TEXT REFERENCES devices(id),
  type TEXT NOT NULL,
  payload JSONB,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_events_device_created_idx ON device_events(device_id, created_at);
CREATE INDEX IF NOT EXISTS device_events_type_created_idx ON device_events(type, created_at);

CREATE TABLE IF NOT EXISTS device_links (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  related_device_id TEXT NOT NULL REFERENCES devices(id),
  relation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_links_device_idx ON device_links(device_id);
