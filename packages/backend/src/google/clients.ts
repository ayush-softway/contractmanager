import { google, docs_v1, drive_v3 } from 'googleapis';
import { getAuthorizedClient } from '../auth/tokens.js';

// Factories that return Google API clients bound to a specific user. These
// are called on every request — they're cheap since they just wrap an
// OAuth2Client. The OAuth2Client itself refreshes its access token
// automatically on 401s from Google.

export function driveFor(userId: string): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: getAuthorizedClient(userId) });
}

export function docsFor(userId: string): docs_v1.Docs {
  return google.docs({ version: 'v1', auth: getAuthorizedClient(userId) });
}

export function peopleFor(userId: string) {
  return google.people({ version: 'v1', auth: getAuthorizedClient(userId) });
}
