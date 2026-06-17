# CONTRACTGEN DEPLOYMENT-READY PATCH — Instructions for AI Agent

## Prerequisites
The first bugfix patch (`contractgen-bugfix.patch`) must already be applied on branch `fix/contract-bugs-sprint`.
This patch builds on top of it.

## How to apply

```bash
# 1. Ensure you're on the first fix branch
cd contractmanager
git checkout fix/contract-bugs-sprint

# 2. Create the deployment branch
git checkout -b fix/deployment-ready

# 3. Apply this patch
git apply contractgen-deployment-ready.patch

# 4. Delete SQLite DB (schema hasn't changed, but stale data from upload
#    routes stored wrong user_id — contracts would be invisible)
rm -f packages/backend/data/contract-generator.db

# 5. Commit and push
git add -A
git commit -m "fix: deployment-ready — iframe, Docs sync, override modal, highlighting"
git push origin fix/deployment-ready
```

## What this patch changes (7 files, 377 lines)

### Backend (4 files)

**`packages/backend/src/routes/ai.ts`**
- Added `isDemoDoc` guard: checks `contract.driveFileId === 'demo-mock-id'` before any Google Docs API call. Without this, demo mode crashes with `No stored Google credentials for user demo-user`.
- Added `import { appendText } from '../google/docs.js'` and `import { docsFor } from '../google/clients.js'` — these modules already exist in the codebase but were never called from the AI route.
- Captures `oldValue = fields[field]` BEFORE overwriting with `newValue`. Needed for `replaceAllText`.
- Field patch sync: when `!isDemoDoc`, calls `docs.documents.batchUpdate → replaceAllText` to find old value in the Google Doc and replace with new value. Wrapped in try/catch — failure is logged but doesn't break the chat.
- Clause add sync: when `!isDemoDoc`, calls `appendText()` to append the new clause text to the Google Doc. Also try/catch.
- Clause removal is NOT synced to Google Docs (too complex without index tracking) — user can delete in the live editor.
- Added `userId` extraction from request for Google API calls.

**`packages/backend/src/routes/upload.ts`**
- J3A finalize (`POST /upload/j3a/finalize`): added `const dbUserId = userId === 'demo-user' ? null : userId;` and uses `dbUserId` in the INSERT. Previously stored `'demo-user'` as `user_id`, making J3A contracts invisible in the vault (which queries `WHERE user_id IS NULL`).
- J3B finalize (`POST /upload/j3b/finalize`): same fix.

**`packages/backend/src/routes/contracts.ts`**
- Line 152: `docusign_envelope_id` → `docusignEnvelopeId` in the send-for-signature response. The contract object from `rowToContract()` is camelCase, so the spread should be too.

**`packages/backend/src/services/ai.ts`**
- `reviewChat()`: added defensive `delete cleanFields.__clause_modifications` before building the field context string sent to Claude. Prevents the AI from seeing internal tracking JSON as an editable field.

### Frontend (3 files)

**`packages/web/components/ContractDoc.tsx`**
- **BUG FIX:** Replaced `useEffect` that set `ref.current.innerHTML` with a `useMemo` that computes `processedHtml` (with amber `{{variable}}` badges). `dangerouslySetInnerHTML` now receives `processedHtml` directly.
- **Why this was broken:** React's `dangerouslySetInnerHTML={{ __html: html }}` uses the raw string. On first render, it set innerHTML to raw mustaches. The `useEffect` ran after paint and re-set innerHTML with badges — causing a visible flicker. On re-renders from state changes, React could overwrite the useEffect's DOM changes. Using `useMemo` means the processed string is always what React renders.

**`packages/web/app/contracts/[id]/review/page.tsx`**
- **Iframe fix:** Changed `src` from `/preview` to `/edit?rm=embedded`. This embeds the full interactive Google Docs editor instead of a read-only preview. Added `allow="clipboard-read; clipboard-write"` for copy/paste support. Added `key={iframeKey}` that increments after each AI chat response, forcing the iframe to reload and pick up Google Docs API changes.
- **Override modal:** DocuSign button is now always clickable (not hard-locked when clauses fail). When clicked with failing clause checks, it shows a confirmation modal listing the missing clauses: "Are you sure you want to send this contract for signature without these clauses?" with "Go back" and "Send anyway" buttons. "Send anyway" opens the normal send confirmation modal.
- **Type labels:** Added `CONTRACT_TYPE_LABELS` map so contract types display as "Master Services Agreement" or "MSA + SOW" instead of raw slugs.
- Added `showOverrideModal` and `iframeKey` state variables.

**`packages/web/app/vault/page.tsx`**
- Added same `CONTRACT_TYPE_LABELS` map. Contract types now display human-readable labels instead of `Msa Sow` or `Sow Standalone`.

## IMPORTANT NOTES

1. **Database reset recommended.** Old contracts from upload journeys stored `user_id = 'demo-user'` instead of `NULL`. After the fix, new contracts will be stored correctly, but old ones will still be invisible. Delete the DB to start fresh.

2. **Google Docs iframe requires Google sign-in.** The `/edit?rm=embedded` iframe only works when the user is signed into Google in their browser AND has edit access to the document. In demo mode (`driveFileId = 'demo-mock-id'`), the HTML preview component is used instead — the iframe branch is never reached.

3. **Google Docs API sync is best-effort.** If the Google API call fails (rate limit, revoked token, network issue), the error is logged but the chat response still succeeds. The HTML snapshot in SQLite is the source of truth.
