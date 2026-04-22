# Roadmap

This is the suggested build order. Everything before "Ship v1" is the working
skeleton that's already scaffolded in this repo; everything after is the
feature backlog.

## Phase 0 — Skeleton (done, in this repo)

- [x] Monorepo with backend, web, addon, shared packages
- [x] Google OAuth flow (Drive + Docs scopes)
- [x] SQLite DB with users, oauth_tokens, templates, contracts, ai_edits tables
- [x] Template CRUD: create (spawns a Google Doc), list, delete
- [x] Contract generation: copy template → replaceAllText → write row
- [x] AI edit endpoint: read range → Claude → write back
- [x] Web dashboard with templates list and contracts list
- [x] Embedded Docs iframe in contract view
- [x] Workspace add-on skeleton (manifest + card handlers)

## Phase 1 — Ship v1 (first 2–3 weeks)

- [ ] Auto-detect template variables by scanning doc content
- [ ] Variable-entry form with basic validation (required, date, number)
- [ ] Contract status: draft / reviewing / sent / signed (manual for now)
- [ ] AI edit UX: show proposed change, accept/reject, undo
- [ ] Add-on: generate-from-template card working end-to-end
- [ ] Add-on: AI edit selection working end-to-end
- [ ] Onboarding: first-run tutorial that creates a sample NDA template
- [x] **Upload-to-template** — drop a PDF/DOCX or paste a Google Doc link and
      the AI rewrites it as a reusable template with `{{variable}}` placeholders.
      Endpoint: `POST /templates/from-upload`. See
      `services/templates.ts#createTemplateFromUpload`.
- [x] **Seed templates (MSA, SOW)** committed under `docs/templates/` — both
      as engine-ready `.md` and reviewable `.docx`, derived from real Softway
      contracts.

## Phase 2 — DocuSign (week 4)

- [ ] Store DocuSign OAuth tokens per user
- [ ] `POST /contracts/:id/send-for-signature`
  - Exports Doc as PDF via Drive `files.export`
  - Creates DocuSign envelope with signers (recipient roles from variables)
  - Stores envelope ID and mapping from DocuSign tabs to Doc ranges
- [ ] Webhook endpoint `/webhooks/docusign` updates contract status
- [ ] Web UI: "Send for signature" button, status timeline

## Phase 3 — HubSpot (week 5–6)

- [ ] HubSpot OAuth app + per-user tokens
- [ ] Pull: when a HubSpot deal moves to a "Contract stage," auto-generate a
      contract using a pre-configured template
- [ ] Push: on contract status change, update the linked deal's properties
- [ ] Variable mapping: pull deal/company/contact values into template vars

## Phase 4 — Clause library (week 7)

- [ ] `clauses` table: title, body (Doc JSON), tags, jurisdiction
- [ ] Add-on sidebar: searchable clause picker → inserts at cursor
- [ ] Web app: clause management UI
- [ ] AI suggests clauses based on contract context

## Phase 5 — Conditional templates (week 8+)

Current templates only support simple `{{var}}` substitution. Next step:

- [ ] `{{#if has_arbitration}}...{{/if}}` blocks
- [ ] `{{#each parties}}...{{/each}}` loops
- [ ] Template editor gets a "test render" mode to preview with sample data
- [ ] Decision: keep templates as Google Docs with marker syntax, or move to
      a structured template format (ProseMirror JSON) and render to Docs on
      generation. Docs-as-template is simpler; structured templates are more
      powerful.

## Phase 6 — Collaboration & approvals

- [ ] Reviewer workflow: author → reviewer → approver → signer
- [ ] Required approvers per template
- [ ] Redline / tracked-changes view (Google Docs has this; surface it in UI)
- [ ] Comments aggregated across contracts for a user

## Phase 7 — Polish & scale

- [ ] Move DB from SQLite to Postgres
- [ ] Move session storage to Redis
- [ ] Background job queue (BullMQ) for long-running AI tasks and DocuSign polls
- [ ] Audit log: every action against a contract, append-only
- [ ] SSO via Google Workspace (domain-wide)
- [ ] Permissions model: who can create templates, who can generate contracts
      from which templates, who can send for signature

## Phase 8 — Advanced AI

- [ ] Risk scoring: flag clauses that deviate from standard
- [ ] Playbook: org-specific rules ("never agree to uncapped liability")
- [ ] Counterparty redline ingestion: they send back an edited PDF/Doc, we
      diff and summarize
- [ ] Negotiation assistant: suggests counter-proposals
