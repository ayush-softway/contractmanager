# CONTRACTGEN BUGFIX PATCH — Instructions for AI Agent

## Context
This patch fixes 11 bugs in the ContractGen app (repo: `ayush-softway/contractmanager`, branch `main_V3`).
The app is a Next.js 14 + Express/TypeScript + SQLite contract generator for Softway Solutions.

## How to apply

```bash
# 1. Clone and checkout
git clone https://github.com/ayush-softway/contractmanager.git
cd contractmanager
git checkout main_V3

# 2. Create fix branch
git checkout -b fix/contract-bugs-sprint

# 3. Apply the patch
git apply contractgen-bugfix.patch

# 4. Verify no errors
grep -rn "field_values_json\|contract_type\|rendered_html_snapshot\|clause_checks_json\|drive_file_id" packages/backend/src/routes/ai.ts packages/backend/src/routes/contracts.ts packages/web/app/contracts/\[id\]/review/page.tsx
# Should ONLY return SQL UPDATE/INSERT statements (those use snake_case column names correctly)

# 5. Delete the old SQLite database to pick up schema changes
rm -f packages/backend/data/contract-generator.db

# 6. Commit and push
git add -A
git commit -m "fix: resolve 11 bugs — data transform, clause coverage, DocuSign gate, badge, clause durability"
git push origin fix/contract-bugs-sprint
```

## What the patch changes (10 files)

### Backend (6 files)

**`packages/backend/src/services/contracts.ts`**
- Added `rowToContract()` — converts raw SQLite snake_case rows to camelCase Contract objects
- Updated `getContract()` and `listContracts()` to use the transform
- Changed unsubstituted variable fallback from `[key not provided]` to `{{key}}` (for frontend amber highlighting)

**`packages/backend/src/services/ai.ts`**
- Replaced `verifyClauseCoverage()` — was a broken 30-char prefix substring match, now uses keyword-set verification per clause
- Added `CLAUSE_KEYWORDS` map: distinctive legal keywords for each clause that are checked against the rendered HTML
- Non-negotiable clauses require ALL keywords present; flexible require half; optional require any

**`packages/backend/src/routes/ai.ts`**
- Updated all `contract.*` property access from snake_case to camelCase (matching new `rowToContract()` output)
- Added `__clause_modifications` tracking: clause adds/removes are persisted as JSON in `field_values_json`
- After a field edit re-render from the .md template, stored clause modifications are re-applied so added clauses survive
- Clause coverage (`clauseChecks`) now returned in the response so frontend can update without a refetch

**`packages/backend/src/routes/contracts.ts`**
- Updated all `contract.*` property access from snake_case to camelCase

**`packages/backend/src/routes/auth.ts`**
- `/auth/me` endpoint now falls back to `demo-user` when no session cookie is present (fixes homepage in demo mode)

**`packages/backend/src/db/schema.sql`**
- Added `INSERT OR IGNORE INTO users` seed for `demo-user` so `/auth/me` returns a valid user in demo mode

### Frontend (4 files)

**`packages/web/app/contracts/[id]/review/page.tsx`**
- All `contract.*` property access updated from snake_case to camelCase
- `__clause_modifications` stripped from visible field values
- DocuSign button now `disabled` when `!allClausesPass` — shows "🔒 Resolve clauses first"
- `LegalLockBadge` now receives `allClausesPass` and `status` props

**`packages/web/app/contracts/page.tsx`**
- `c.created_at` → `c.createdAt` (fixes Invalid Date)

**`packages/web/components/LegalLockBadge.tsx`**
- Complete rewrite: now accepts `allClausesPass` and `status` props
- Shows amber "CLAUSE REVIEW REQUIRED" when checks fail
- Shows green "ALL CLAUSE CHECKS PASSED" when ready
- Shows locked "LEGAL APPROVED — LOCKED" after sent/signed

**`packages/web/components/ContractDoc.tsx`**
- Now accepts `contractId` and `onHtmlChange` props (were passed but ignored)
- Unsubstituted `{{variable}}` tokens rendered as amber highlighted badges instead of raw mustaches

## IMPORTANT: Database reset required
The schema.sql adds a demo-user seed. If an existing SQLite database exists, delete it before starting the app:
```bash
rm -f packages/backend/data/contract-generator.db
```
The app will recreate it on boot with the updated schema.

## Bugs fixed
1. ✅ Invalid Date in vault/homepage/admin (snake→camelCase transform)
2. ✅ Clause coverage always failing (keyword-set verification)
3. ✅ Add-clause chat doesn't update coverage (fixed verification + mod tracking)
4. ✅ DocuSign button not gated on clause checks (disabled when !allClausesPass)
5. ✅ LegalLockBadge always showing locked (conditional on state)
6. ✅ Homepage broken in demo mode (demo-user seed + /me fallback)
7. ✅ Unsubstituted {{variables}} shown raw (amber badge highlighting)
8. ✅ Field edit wipes added clauses (clause mods re-applied after re-render)
9. ✅ ContractDoc dead props (now accepted)
