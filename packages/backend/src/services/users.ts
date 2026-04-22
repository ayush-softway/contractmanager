import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import type { User } from '@cg/shared';

interface UserRow {
  id: string;
  google_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

function rowToUser(r: UserRow): User {
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    avatarUrl: r.avatar_url ?? undefined,
    createdAt: r.created_at,
  };
}

export function upsertUserByGoogleId(input: {
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}): User {
  const existing = db
    .prepare('SELECT * FROM users WHERE google_id = ?')
    .get(input.googleId) as UserRow | undefined;
  if (existing) {
    db.prepare(
      `UPDATE users SET email = ?, display_name = ?, avatar_url = ? WHERE id = ?`,
    ).run(input.email, input.displayName, input.avatarUrl ?? null, existing.id);
    return rowToUser({
      ...existing,
      email: input.email,
      display_name: input.displayName,
      avatar_url: input.avatarUrl ?? null,
    });
  }
  const id = nanoid();
  db.prepare(
    `INSERT INTO users (id, google_id, email, display_name, avatar_url) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, input.googleId, input.email, input.displayName, input.avatarUrl ?? null);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
  return rowToUser(row);
}

export function getUserById(id: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}
