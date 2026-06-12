# Setup

## Prerequisites

- **Node.js** 18.17+ (`node --version` to check)
- **npm** 9+ (ships with recent Node)
- A **Google account** — a personal account works for dev; you'll want a
  Workspace org for testing the add-on.
- A **Anthropic API key** — get one at https://console.anthropic.com
- **ngrok** (or similar tunnel) — only needed when you wire up the add-on,
  because Google's webhooks need a public HTTPS URL.

## One-time setup

### 1. Clone and install

```bash
cd contract-generator
npm install
```

### 2. Google Cloud credentials

Follow `docs/GOOGLE_CLOUD_SETUP.md` step-by-step. At the end you'll have:

- A `GOOGLE_CLIENT_ID`
- A `GOOGLE_CLIENT_SECRET`
- An authorized redirect URI of `http://localhost:4000/auth/google/callback`

### 3. Fill in `.env`

```bash
cp .env.example .env
# edit .env and fill in the values
```

You need at minimum:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET` — run `openssl rand -hex 32` and paste the output
- `ANTHROPIC_API_KEY` — from https://console.anthropic.com

### 4. Initialize the database

The backend creates `data/contract-generator.db` automatically on first boot
and applies the schema in `packages/backend/src/db/schema.sql`. You don't need
to run migrations manually in dev.

## Run the app

```bash
npm run dev
```

This starts:
- Backend on http://localhost:4000
- Web app on http://localhost:3000

Open http://localhost:3000, click "Sign in with Google", grant the Drive and
Docs scopes, and you should land on the dashboard.

## Running just one service

```bash
npm run dev:backend   # just the API
npm run dev:web       # just the Next.js app
npm run dev:addon     # just the add-on webhook server (needs ngrok)
```

## Testing the add-on locally

The add-on lives in `packages/addon`. It's an Express server on port 4100 that
responds to Google's CardService webhooks.

1. Start the add-on server: `npm run dev:addon`
2. Expose it publicly: `ngrok http 4100` — copy the HTTPS URL.
3. Set `ADDON_PUBLIC_URL` in `.env` to the ngrok URL.
4. In Google Cloud Console → Google Workspace Marketplace SDK, create an
   add-on with the manifest at `packages/addon/appsscript.json`, pointing the
   `httpOptions.url` fields at your ngrok URL.
5. Install the add-on privately into your Workspace domain (or your personal
   account for testing). See `packages/addon/README.md` for details.

## Troubleshooting

**"redirect_uri_mismatch" on sign-in**
Your `GOOGLE_REDIRECT_URI` in `.env` must exactly match the Authorized
Redirect URI you registered in Google Cloud Console. Scheme, host, port, path
all matter.

**"insufficient authentication scopes"**
You probably granted some scopes but not all. Sign out, revoke access at
https://myaccount.google.com/permissions, then sign in again.

**"Could not find file"**
The Drive `drive.file` scope only gives us access to files we created or the
user explicitly opens with our app. Files created manually in Docs won't be
visible until the user opens them with the app (for the add-on) or until they
were created via our API.

**Backend won't start: "better-sqlite3 not found"**
Run `npm rebuild better-sqlite3` inside `packages/backend`. Sometimes the
native module needs to be rebuilt against your Node version.
