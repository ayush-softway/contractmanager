import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, sqlitePathFromUrl } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = sqlitePathFromUrl(config.DATABASE_URL);
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply the schema on boot. It's idempotent (CREATE TABLE IF NOT EXISTS).
const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schemaSql);

// Column-level migrations — try/catch because SQLite errors if column exists.
try { db.exec(`ALTER TABLE templates ADD COLUMN sections_json TEXT NOT NULL DEFAULT '[]'`); } catch { /* already exists */ }

export type DB = typeof db;
