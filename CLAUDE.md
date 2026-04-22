# CLAUDE.md

Guidance for Claude Code when iterating on this repo.

## Repo shape

npm-workspaces monorepo. Four packages under `packages/`:

- `shared` — pure TypeScript types. No runtime deps. Imported by all others.
- `backend` — Express API. Owns: Google OAuth, Drive/Docs clients, DB, AI.
- `web` — Next.js app. Proxies to backend via `/api/backend/*` rewrite.
- `addon` — Google Workspace add-on webhook server.

## Start here

1. `docs/ARCHITECTURE.md` — system overview, data flow, design decisions
2. `docs/SETUP.md` — environment setup
3. `docs/GOOGLE_CLOUD_SETUP.md` — OAuth + API enablement
4. `docs/ROADMAP.md` — what to build next, in order

## Conventions

- TypeScript, strict mode, `"type": "module"` in backend + addon
- ESM imports with explicit `.js` extensions (required by `NodeNext` moduleResolution)
- Zod for input validation at route boundaries
- `nanoid` for IDs; avoid sequential integers
- SQLite via `better-sqlite3` (synchronous — that's intentional and idiomatic)
- Env parsed centrally in `packages/backend/src/config.ts`; import `config` everywhere

## Safe changes

- Adding routes: follow the pattern in `routes/templates.ts`
- Adding Google API calls: add to `google/drive.ts` or `google/docs.ts`, call
  `driveFor(userId)` / `docsFor(userId)` to get authenticated clients
- Adding DB tables: edit `db/schema.sql` and re-import `db/client.ts` — it
  applies the file on boot (CREATE TABLE IF NOT EXISTS is idempotent)

## Watch out for

- OAuth `drive.file` scope only sees files our app created or that the user
  explicitly opened with our app. Don't assume we can see arbitrary Drive files.
- Docs API indices are 1-based and include structural characters. The
  `extractRangeText` helper in `google/docs.ts` approximates, not exact.
- `prompt: 'consent'` is on the OAuth flow — without it, re-signing-in
  won't return a `refresh_token` and refreshes will silently fail later.
- The add-on currently trusts an `X-User-Email` header. That's a known TODO;
  it should verify the Google ID token server-side and resolve to a user.

## Running

```bash
npm install
npm run dev              # backend + web
npm run dev:addon        # add-on webhook server (needs ngrok)
```
