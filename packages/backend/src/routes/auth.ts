import crypto from 'node:crypto';
import { Router } from 'express';
import { google } from 'googleapis';
import { config } from '../config.js';
import { buildAuthUrl, createOAuthClient } from '../auth/google.js';
import { saveTokens } from '../auth/tokens.js';
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  getSessionIdFromReq,
  setSessionCookie,
} from '../auth/session.js';
import { upsertUserByGoogleId, getUserById } from '../services/users.js';

export const authRouter: Router = Router();

// In-memory state store for OAuth CSRF protection. Fine for dev; move to
// Redis or a signed cookie for multi-instance deployment.
const oauthStates = new Set<string>();

authRouter.get('/google/login', (_req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.add(state);
  // Clean up stale states after 10 min.
  setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000).unref();
  res.redirect(buildAuthUrl(state));
});

authRouter.get('/google/callback', async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state || !oauthStates.has(state)) {
    return res.status(400).send('Invalid OAuth state');
  }
  oauthStates.delete(state);

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Fetch basic profile using the token we just got.
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const profile = await oauth2.userinfo.get();
    const googleId = profile.data.id;
    const email = profile.data.email;
    const displayName = profile.data.name ?? profile.data.email ?? 'User';
    const avatarUrl = profile.data.picture ?? undefined;

    if (!googleId || !email) {
      return res.status(500).send('Google returned an incomplete profile');
    }

    const user = upsertUserByGoogleId({ googleId, email, displayName, avatarUrl });
    saveTokens(user.id, tokens);

    const session = createSession(user.id);
    setSessionCookie(res, session.id, session.expiresAt);

    res.redirect(config.WEB_ORIGIN);
  } catch (err) {
    console.error('OAuth callback failed:', err);
    res.status(500).send('OAuth callback failed; see server logs.');
  }
});

authRouter.post('/logout', (req, res) => {
  const sid = getSessionIdFromReq(req);
  if (sid) deleteSession(sid);
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  const userId = (req as unknown as { userId?: string }).userId;
  if (!userId) return res.status(401).json({ error: 'unauthorized', message: 'Not signed in' });
  const user = getUserById(userId);
  if (!user) return res.status(404).json({ error: 'not_found', message: 'User missing' });
  res.json({ user });
});
