import type { Credentials } from 'google-auth-library';
import { db } from '../db/client.js';
import { createOAuthClient } from './google.js';

// Token storage and refresh. In production you should encrypt refresh tokens
// at rest — for dev SQLite this is left as-is to keep the skeleton readable.
// TODO: add field-level encryption before shipping.

interface StoredToken {
  access_token: string;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  expiry_date: number | null;
}

export function saveTokens(userId: string, creds: Credentials): void {
  db.prepare(
    `INSERT INTO oauth_tokens (user_id, access_token, refresh_token, scope, token_type, expiry_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       access_token=excluded.access_token,
       refresh_token=COALESCE(excluded.refresh_token, oauth_tokens.refresh_token),
       scope=excluded.scope,
       token_type=excluded.token_type,
       expiry_date=excluded.expiry_date,
       updated_at=datetime('now')`,
  ).run(
    userId,
    creds.access_token ?? '',
    creds.refresh_token ?? null,
    creds.scope ?? null,
    creds.token_type ?? null,
    creds.expiry_date ?? null,
  );
}

export function loadTokens(userId: string): Credentials | null {
  const row = db
    .prepare('SELECT access_token, refresh_token, scope, token_type, expiry_date FROM oauth_tokens WHERE user_id = ?')
    .get(userId) as StoredToken | undefined;
  if (!row) return null;
  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token ?? undefined,
    scope: row.scope ?? undefined,
    token_type: row.token_type ?? undefined,
    expiry_date: row.expiry_date ?? undefined,
  };
}

/**
 * Returns an OAuth2Client primed with the user's tokens and auto-refresh wired up.
 * Use this to make authenticated Google API calls on behalf of `userId`.
 */
export function getAuthorizedClient(userId: string) {
  const creds = loadTokens(userId);
  if (!creds) {
    throw new Error(`No stored Google credentials for user ${userId}`);
  }
  const client = createOAuthClient();
  client.setCredentials(creds);

  // When the client refreshes access_token, persist the new one.
  client.on('tokens', (newCreds) => {
    // Merge into existing — refresh events don't always include refresh_token.
    saveTokens(userId, { ...creds, ...newCreds });
  });

  return client;
}
