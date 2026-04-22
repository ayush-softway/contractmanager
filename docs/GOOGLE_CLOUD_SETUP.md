# Google Cloud Setup

Step-by-step to get your Google OAuth credentials and enable the APIs this app
depends on.

## 1. Create a Google Cloud project

1. Go to https://console.cloud.google.com
2. Top-left, click the project dropdown → **New Project**
3. Name it (e.g. "Contract Generator Dev") and click Create
4. Make sure the new project is selected in the project dropdown

## 2. Enable the APIs

Go to **APIs & Services → Library** and enable each of these:

- **Google Docs API**
- **Google Drive API**
- **Google Workspace Marketplace SDK** (only needed when you publish the add-on)

## 3. Configure the OAuth consent screen

Go to **APIs & Services → OAuth consent screen**.

1. User type: **External** (unless you're in a Workspace org and want
   Internal — Internal skips verification entirely).
2. App name: "Contract Generator"
3. User support email: your email
4. Developer contact: your email
5. On the **Scopes** step, click "Add or Remove Scopes" and add:
   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/documents`
6. On the **Test users** step, add your own Google email (and any teammates).
   While the app is in "Testing" mode, only test users can sign in — this is
   fine for dev and you won't need verification.
7. Save and continue.

**Important**: we intentionally use `drive.file` (not `drive`). This is a
**non-sensitive** scope, which means you can stay in Testing mode with up to
100 test users without going through Google's verification process. If you
ever add the broader `drive` scope, you'll need a paid third-party security
review that takes 6–8 weeks. Don't do that.

## 4. Create OAuth credentials

Go to **APIs & Services → Credentials**.

1. Click **+ Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Name: "Contract Generator backend (dev)"
4. Authorized JavaScript origins:
   - `http://localhost:3000`
   - `http://localhost:4000`
5. Authorized redirect URIs:
   - `http://localhost:4000/auth/google/callback`
6. Click **Create**
7. Copy the **Client ID** and **Client secret** into your `.env` as
   `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## 5. (Later) Prepare for production

When you deploy:
1. Add your production domain to Authorized JavaScript origins and redirect URIs.
2. If you're going public, submit for OAuth app verification (only required for
   sensitive scopes — we don't use any, so skip this).
3. Create a separate OAuth client for production so dev/prod credentials don't mix.

## 6. (Later) Workspace Add-on setup

See `packages/addon/README.md`. You'll deploy the add-on via the Google
Workspace Marketplace SDK using the manifest at `packages/addon/appsscript.json`.

## Common mistakes

**Using `drive` instead of `drive.file`**
`drive` is a sensitive/restricted scope that triggers Google's security review.
`drive.file` is non-sensitive and gives us exactly what we need: access to files
we create or the user explicitly opens with our app.

**Redirect URI typos**
The redirect URI in `.env` must *exactly* match the one in Google Cloud
Console — including trailing slash, port, and scheme. A mismatch produces a
`redirect_uri_mismatch` error that's easy to misdiagnose.

**Forgetting to add yourself as a test user**
In Testing mode, only users listed under "Test users" can sign in. You'll see
a "this app hasn't been verified" error if you try with a non-listed account.
