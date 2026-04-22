# @cg/backend

Express + TypeScript API. Talks to Google (Drive + Docs), Google Gemini (AI),
and our SQLite database.

## Endpoints

| Method | Path                            | Purpose                                     |
|--------|---------------------------------|---------------------------------------------|
| GET    | `/health`                       | Liveness check                              |
| GET    | `/auth/google/login`            | Starts the Google OAuth flow                |
| GET    | `/auth/google/callback`         | OAuth redirect target                       |
| POST   | `/auth/logout`                  | Clears session                              |
| GET    | `/auth/me`                      | Current signed-in user                      |
| GET    | `/templates`                    | List the user's templates                   |
| POST   | `/templates`                    | Create a blank template (spawns a Doc)      |
| GET    | `/templates/:id`                | Fetch a template                            |
| POST   | `/templates/:id/sync`           | Re-scan the Doc for `{{var}}` placeholders  |
| DELETE | `/templates/:id`                | Delete a template                           |
| GET    | `/contracts`                    | List the user's contracts                   |
| POST   | `/contracts/generate`           | Copy template + replace variables           |
| GET    | `/contracts/:id`                | Fetch a contract                            |
| PATCH  | `/contracts/:id/status`         | Update status                               |
| POST   | `/ai/edit`                      | Run an AI edit on a doc                     |

## Code layout

```
src/
├── index.ts              # Express bootstrap
├── config.ts             # env parsing (zod-validated)
├── db/
│   ├── client.ts         # better-sqlite3 + auto-apply schema
│   └── schema.sql        # tables & indexes
├── auth/
│   ├── google.ts         # OAuth URL + scopes
│   ├── tokens.ts         # save/load + refresh handling
│   └── session.ts        # session cookies + middleware
├── google/
│   ├── clients.ts        # per-user Drive + Docs client factories
│   ├── drive.ts          # folder ensure, copy, delete
│   └── docs.ts           # read doc, detect vars, replace vars, replace range
├── services/
│   ├── users.ts          # upsert users
│   ├── templates.ts      # template CRUD
│   ├── contracts.ts      # contract CRUD + generate
│   └── ai.ts             # orchestrate Gemini AI edits
└── routes/
    ├── auth.ts
    ├── templates.ts
    ├── contracts.ts
    └── ai.ts
```

## Local dev

```bash
npm install
npm run dev          # tsx watch src/index.ts
```

## Things the skeleton doesn't do yet

- Encryption of OAuth refresh tokens at rest
- Rate limiting (add `express-rate-limit`)
- CSRF protection on the logout endpoint (mitigated by SameSite=lax cookie,
  but belts and braces is better)
- Structured logging (pino / winston)
- Tests

See `docs/ROADMAP.md` in the repo root for the full backlog.
