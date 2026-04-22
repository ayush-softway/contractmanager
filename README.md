# Contract Generator

A contract-generation platform built on top of Google Docs & Drive. Users create templates, generate contracts by filling in variables, edit collaboratively in Google Docs, and use AI to refine contract language. A Google Workspace add-on brings the same capabilities into Docs itself.

## What's in this repo

This is an npm-workspaces monorepo with four packages:

```
contract-generator/
├── packages/
│   ├── shared/     # Types shared across all packages
│   ├── backend/    # Express API: Google OAuth, Drive, Docs, AI
│   ├── web/        # Next.js web app (templates, contracts, AI sidebar)
│   └── addon/      # Google Workspace add-on (HTTP-backed)
└── docs/           # Architecture, setup, and roadmap
```

## Quick start

1. Read `docs/SETUP.md` end to end.
2. Follow `docs/GOOGLE_CLOUD_SETUP.md` to get your Google OAuth credentials.
3. Copy `.env.example` to `.env` and fill in values.
4. Install and run:

```bash
npm install
npm run dev        # runs backend + web concurrently
```

Backend boots on `http://localhost:4000`. Web app boots on `http://localhost:3000`.

## What works today

- Google OAuth sign-in (Drive + Docs scopes)
- Template management: list, create (opens a blank Doc), delete
- Contract generation from a template with variable substitution
- Embedded Docs iframe in the web app
- AI editing via Claude (rewrite selected text using the Docs API)
- Workspace add-on skeleton with generate-from-template and AI-edit cards

## What to build next

See `docs/ROADMAP.md` for the full backlog: DocuSign integration, HubSpot CRM sync,
clause library, conditional template logic, versioning, approval workflows.

## Architecture

See `docs/ARCHITECTURE.md` for the full write-up. TL;DR: both the web app and the
add-on are thin UIs over a single backend API; contracts live in the user's own
Google Drive; document metadata lives in our database.
