import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from '../db/client.js';

// Minimal session implementation: opaque session id in an httpOnly cookie,
// sessions table in SQLite. Swap for Redis/iron-session/Lucia later.

const COOKIE_NAME = 'cg_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function createSession(userId: string): { id: string; expiresAt: Date } {
  const id = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
  ).run(id, userId, expiresAt.toISOString());
  return { id, expiresAt };
}

export function deleteSession(id: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function getSessionUserId(id: string): string | null {
  const row = db
    .prepare(
      `SELECT user_id FROM sessions WHERE id = ? AND datetime(expires_at) > datetime('now')`,
    )
    .get(id) as { user_id: string } | undefined;
  return row?.user_id ?? null;
}

export function setSessionCookie(res: Response, id: string, expiresAt: Date): void {
  res.cookie(COOKIE_NAME, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    expires: expiresAt,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
}

export function getSessionIdFromReq(req: Request): string | null {
  const cookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
  return cookie ?? null;
}

/** Populate req.userId if a valid session cookie is present. Does not reject requests. */
export function sessionMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const id = getSessionIdFromReq(req);
  if (id) {
    const userId = getSessionUserId(id);
    if (userId) {
      (req as Request & { userId?: string }).userId = userId;
    }
  }
  next();
}

/** Reject requests that don't have a valid session. Mount after sessionMiddleware. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as Request & { userId?: string }).userId;
  if (!userId) {
    return void res.status(401).json({ error: 'unauthorized', message: 'Not signed in' });
  }
  next();
}
