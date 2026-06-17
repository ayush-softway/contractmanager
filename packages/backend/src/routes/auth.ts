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
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

  // Google sends ?error=access_denied when the user declines or isn't a test user
  if (error) {
    console.error('Google OAuth returned error:', error);
    return res.status(403).send(
      `Google sign-in failed: ${error}. ` +
      'If the app is in "Testing" mode, make sure your Google account is listed as a test user in the Google Cloud Console.'
    );
  }

  if (!code || !state || !oauthStates.has(state)) {
    console.error('OAuth state validation failed.', {
      hasCode: !!code,
      hasState: !!state,
      stateValid: state ? oauthStates.has(state) : false,
      pendingStates: oauthStates.size,
    });
    return res.status(400).send(
      'Invalid OAuth state — the login session may have expired or the server may have restarted. Please try signing in again.'
    );
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
      console.error('Google profile incomplete:', { googleId, email });
      return res.status(500).send('Google returned an incomplete profile');
    }

    const user = upsertUserByGoogleId({ googleId, email, displayName, avatarUrl });
    saveTokens(user.id, tokens);

    const session = createSession(user.id);
    setSessionCookie(res, session.id, session.expiresAt);

    console.log(`✔ OAuth login: ${email} (user ${user.id})`);
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
  // In demo mode, requireAuth (global or per-route) sets userId = 'demo-user'.
  // sessionMiddleware sets it from cookies if available.
  // Fallback to demo-user so the homepage works without a session cookie.
  const userId = (req as unknown as { userId?: string }).userId || 'demo-user';
  const user = getUserById(userId);
  if (!user) return res.status(404).json({ error: 'not_found', message: 'User missing' });
  res.json({ user });
});
