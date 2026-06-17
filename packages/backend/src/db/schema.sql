-- Softway ContractGen V2 — Clean Schema
-- Applied automatically by db/client.ts on first boot.
-- SQLite dialect (better-sqlite3).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  token_type TEXT,
  expiry_date INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

-- V2 templates: the 3 legal-approved locked starters
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v2',
  active INTEGER NOT NULL DEFAULT 1,
  drive_doc_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- V2 contracts: the core entity
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('msa', 'msa-sow', 'sow-standalone', 'change-order')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'signed')),
  drive_file_id TEXT,
  pdf_drive_file_id TEXT,
  docusign_envelope_id TEXT,
  import_source_json TEXT,
  field_values_json TEXT,
  rendered_html_snapshot TEXT,
  clause_checks_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS contracts_user_idx ON contracts(user_id);

-- Clause Library: single source of truth for all Softway legal language
CREATE TABLE IF NOT EXISTS clauses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('non-negotiable', 'flexible', 'optional')),
  body TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed placeholder clauses (no-op on subsequent boots)
INSERT OR IGNORE INTO clauses (id, name, type, body, updated_by, updated_at) VALUES
  ('clause-ip', 'IP Ownership', 'non-negotiable', 'All intellectual property created by Softway Solutions under this Agreement shall remain the exclusive property of Client upon full payment of all fees.', 'Chris Pitre', '2026-04-28T00:00:00.000Z'),
  ('clause-liability', 'Liability Cap', 'non-negotiable', 'In no event shall either party''s total liability exceed the total fees paid or payable under this Agreement in the twelve (12) months preceding the claim.', 'Chris Pitre', '2026-04-24T00:00:00.000Z'),
  ('clause-payment', 'Payment Terms', 'flexible', 'Client shall pay all undisputed invoices within thirty (30) days of receipt. Late payments shall accrue interest at 1.5% per month.', 'Melissa Grant', '2026-04-20T00:00:00.000Z'),
  ('clause-confidentiality', 'Confidentiality', 'non-negotiable', 'Each party agrees to maintain in strict confidence all Confidential Information of the other party and not to disclose such information to any third party without prior written consent.', 'Chris Pitre', '2026-04-18T00:00:00.000Z'),
  ('clause-travel', 'Travel & Expenses', 'optional', 'Client shall reimburse Softway for all pre-approved travel and out-of-pocket expenses incurred in connection with the Services, not to exceed the travel cap set forth in the applicable SOW.', 'Alex Rivera', '2026-04-15T00:00:00.000Z');

-- Seed demo user so /auth/me works in demo mode
INSERT OR IGNORE INTO users (id, google_id, email, display_name, avatar_url, created_at)
VALUES ('demo-user', 'demo-google-id', 'demo@softwaysolutions.com', 'Shivansh', NULL, datetime('now'));
