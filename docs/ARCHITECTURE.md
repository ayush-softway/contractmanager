# Architecture

## The big picture

```
 ┌───────────────────────┐       ┌─────────────────────────────┐
 │  Web app (Next.js)    │       │  Google Docs + add-on       │
 │  - Templates list     │       │  - Sidebar (HTTP-backed)    │
 │  - Contracts list     │       │  - Generate from template   │
 │  - Embedded Doc       │       │  - AI edit selection        │
 │  - AI sidebar         │       │  - Insert clause            │
 └───────────┬───────────┘       └───────────────┬─────────────┘
             │ REST + cookies                    │ webhook JSON
             │                                   │
             └───────────────┬───────────────────┘
                             ▼
                ┌──────────────────────────┐
                │  Backend (Express + TS)  │
                │  - Google OAuth          │
                │  - Drive + Docs clients  │
                │  - Template registry     │
                │  - Contract registry     │
                │  - AI orchestration      │
                │  - DocuSign / HubSpot    │  (future)
                └───────┬──────────────────┘
                        │
            ┌───────────┼─────────────┐
            ▼           ▼             ▼
     ┌────────────┐ ┌──────────┐ ┌──────────┐
     │  SQLite    │ │  Google  │ │  Gemini  │
     │  (metadata)│ │  APIs    │ │   API    │
     └────────────┘ └──────────┘ └──────────┘
```

The core idea: **both clients share one backend**. Web app and add-on are
different UIs over the same endpoints — `POST /contracts/generate`,
`POST /ai/edit`, `GET /templates`, etc. This means features like DocuSign
integration, added once, show up in both surfaces automatically.

## Source of truth

- **Document content** lives in Google Drive (as Google Docs), owned by the user.
- **Metadata** (template registry, contract registry, AI edit history, user
  accounts, OAuth tokens) lives in our database.

The Drive file ID is the foreign key from our world into Google's.

## Why user-owned documents

Each user grants OAuth with the `drive.file` scope, which lets us create and
access only the files we create or that the user explicitly opens with our app.
The contracts live in their Drive, they own them, they can share them with
collaborators using normal Google sharing. We never hold user content in our
database.

This matters for three reasons:
1. We sidestep Google's slow security review (needed for broader scopes).
2. Customers' legal/IT teams are fine with it — the docs never leave Google.
3. We stay thin. We're a workflow + AI layer, not a storage provider.

## Template → contract flow

1. User creates a template from the web app. We call Drive `files.create` to
   make a blank Google Doc in a "Contract Templates" folder in their Drive,
   write a row in our `templates` table, and open the Doc in a new tab.
2. User writes the template content in Docs using `{{variable_name}}` syntax.
3. Our app auto-detects variables on next sync (regex over doc content).
4. User generates a contract: picks template, fills variable form, submits.
5. Backend calls Drive `files.copy`, then Docs `batchUpdate` with
   `replaceAllText` requests (one per variable), then writes a row to
   `contracts`. Takes ~1–2 seconds.
6. User edits the generated contract in Docs (embedded iframe or new tab).
7. User triggers AI edit from sidebar. Backend reads relevant range via Docs
   `documents.get`, sends to Claude, writes result back via
   `documents.batchUpdate` (delete range + insert text).

## The add-on story

The add-on is an HTTP-backed Google Workspace Add-on. The manifest points to
our backend. When the user clicks a button in the sidebar, Google sends a
JSON webhook to our backend with the event context (including the current doc
ID and selection). We respond with a `Card` JSON describing the UI to render.

Critically, the add-on calls the **same backend endpoints** as the web app. The
only extra logic is the CardService JSON layer in `packages/addon`.

The add-on has one capability the web app doesn't: **access to the user's
current selection in Docs**. This makes inline AI editing much nicer inside
the add-on than in the web app's sidebar.

## Why Express + SQLite (and not Postgres + Prisma + …)

This is a skeleton designed to get you running in an afternoon. Swap SQLite for
Postgres (or swap `better-sqlite3` for Drizzle/Prisma) the moment you need
multi-writer durability or hosted deployment. The data layer is isolated in
`packages/backend/src/db/` so the swap is mechanical.

## Future integrations (not yet wired)

- **DocuSign**: `POST /contracts/:id/send-for-signature`. Uploads the Doc as a
  PDF, creates an envelope, stores the envelope ID. Webhook endpoint updates
  contract status on signature events.
- **HubSpot**: bidirectional sync. When a deal moves to "Contract Stage," we
  auto-generate the contract; when a contract is signed, we update the deal.
- **Clause library**: a `clauses` table (title, body, tags). Add-on sidebar
  has a searchable picker; web app has drag-and-drop.
- **Approval workflows**: contracts have states (draft → review → approved →
  sent → signed → executed). Reviewers get notified.

See `docs/ROADMAP.md` for the sequenced plan.
