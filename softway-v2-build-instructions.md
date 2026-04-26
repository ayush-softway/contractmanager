# Softway ContractGen V2 — Vision & Build Instructions

> **Branch:** `main-v2` (renamed from `v2`)  
> **Status:** V1 archived at `git tag archive/v1-original`  
> **Demo Target:** PumpWorks end-to-end flow, under 3 minutes  

---

## The Vision in One Paragraph

Softway generates contracts manually — sales reps pull random Google Docs from personal Drives, copy-paste from old contracts, and send them out. 6 of 7 contracts audited were missing at least one critical legal clause. The $480k Tokyo Gardens contract had 4 missing clauses. The $150k PumpWorks contract had a contradictory attendee count in a legally binding clause. The root cause is not speed — it is the absence of a system. ContractGen V2 fixes this with one job: take 22 inputs from a sales rep and produce a legally complete, correctly formatted contract in under 3 minutes, every time, without exception.

---

## The 3-Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│  LAYER 3 — AI ASSIST (post-demo, not in V2 scope)   │
│  Clause gap detection, inconsistency checker,       │
│  Gemini first-draft from HubSpot data               │
├─────────────────────────────────────────────────────┤
│  LAYER 2 — SMART ASSEMBLY ENGINE (build this now)   │
│  22-field form → locked template → PDF → DocuSign   │
├─────────────────────────────────────────────────────┤
│  LAYER 1 — LOCKED CONTENT (already authored)        │
│  3 legal-approved templates, never editable         │
└─────────────────────────────────────────────────────┘
```

Layer 1 is done. Layer 2 is the entire V2 build. Layer 3 is not in scope.

---

## What We Keep from V1 (Infrastructure Only)

| Keep | Location | Reason |
|---|---|---|
| Google OAuth + session handling | `backend/src/auth/` | Works, don't touch |
| Drive API client | `backend/src/google/drive.ts` | Reused + extended |
| Docs API client | `backend/src/google/docs.ts` | Core to template fill |
| Next.js + Express monorepo | Root | Structure stays |
| Database connection + ORM | `backend/src/db/` | Connection only — rewrite schema |
| Deployment config | Root `.env`, config files | Keep |

## What We Delete from V1 (Product Layer)

```
DELETE entirely:
/packages/web/app/*               ← all V1 UI pages
/backend/src/routes/*             ← all V1 routes
/backend/src/services/*           ← all V1 services (except what V2 explicitly reuses)
/backend/starter-templates/*      ← old templates only (keep the 3 new V2 ones)
```

Do not attempt to patch or preserve V1 product code. Archive it at `git tag archive/v1-original` and move on.

---

## Database Schema — Write Fresh

Drop and recreate. There is no production data worth preserving.

```sql
-- V2 Clean Schema

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id     TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id),
  title                 TEXT NOT NULL,
  contract_type         TEXT NOT NULL CHECK (contract_type IN ('msa-sow', 'sow-standalone', 'change-order')),
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'signed')),
  drive_file_id         TEXT,
  pdf_drive_file_id     TEXT,
  docusign_envelope_id  TEXT,
  import_source_json    JSONB,
  field_values_json     JSONB,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  version     TEXT NOT NULL DEFAULT 'v2',
  active      BOOLEAN DEFAULT true,
  drive_doc_id TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**Migration note:** Use `IF NOT EXISTS` guards on all `ALTER TABLE` statements if running against an existing DB.

---

## The 3 Locked Templates (Layer 1 — Already Authored)

These live in `backend/starter-templates/`. They were converted from `.md` to `.docx` via pandoc. Do not edit the content — legal has approved these.

| Slug | File | When Used |
|---|---|---|
| `msa-sow` | `msa-sow.docx` | New client — full MSA + SOW merged, all 6 legal protections |
| `sow-standalone` | `sow-standalone.docx` | Repeat client — SOW body + "governed by MSA dated {{msa_date}}" |
| `change-order` | `change-order.docx` | Scope/pricing update — delta fields only |

Register all three in `backend/src/services/starters.ts`:
```typescript
export const STARTERS = [
  { slug: 'msa-sow', label: 'MSA + SOW-01 (New Client)', version: 'v2', active: true },
  { slug: 'sow-standalone', label: 'Standalone SOW (Repeat Client)', version: 'v2', active: true },
  { slug: 'change-order', label: 'Change Order', version: 'v2', active: true },
];
```

**Drive permissions:** Once a template is imported into Drive, set it to view-only for all users except the template owner. Nobody edits the source template.

---

## The 22 Variables — Canonical Reference

Every variable uses `{{snake_case}}` format consistently across all 3 templates.

| # | Variable | Maps To | Source |
|---|---|---|---|
| 1 | `{{client_legal_name}}` | Client full legal name | HubSpot company |
| 2 | `{{client_address}}` | Client address | HubSpot company |
| 3 | `{{client_contact_name}}` | Primary contact name | HubSpot contact |
| 4 | `{{client_contact_email}}` | Primary contact email | HubSpot contact |
| 5 | `{{softway_rep}}` | Softway account owner | HubSpot deal owner |
| 6 | `{{sow_number}}` | SOW reference number | Auto-generated |
| 7 | `{{msa_date}}` | Prior MSA effective date | Manual |
| 8 | `{{contract_date}}` | Today's date | Auto (server) |
| 9 | `{{completion_date}}` | Project end date | Manual |
| 10 | `{{service_type}}` | Short scope description | Manual / Drive |
| 11 | `{{workshop_count}}` | Number of workshops | Manual / Drive |
| 12 | `{{duration_hrs}}` | Hours per session | Manual / Drive |
| 13 | `{{attendee_count}}` | Number of attendees | Manual / Drive |
| 14 | `{{facilitator_count}}` | Number of facilitators | Manual / Drive |
| 15 | `{{location}}` | Engagement location | Manual / Drive |
| 16 | `{{project_fee_usd}}` | Total contract value | HubSpot deal amount |
| 17 | `{{discount_type}}` | Discount label | Manual |
| 18 | `{{discount_amount}}` | Discount value | Manual |
| 19 | `{{payment_structure}}` | Payment terms | Manual |
| 20 | `{{travel_required}}` | Travel flag (yes/no) | Manual |
| 21 | `{{travel_cap}}` | Travel reimbursement cap | Manual |
| 22 | `{{event_dates}}` | Scheduled event dates | Manual / Drive |

---

## Backend — New Files to Build

### File Structure
```
packages/backend/src/
├── google/
│   ├── drive.ts          ← EXTEND: add exportAsPdf() — do not modify existing functions
│   └── docs.ts           ← KEEP as-is
├── services/
│   ├── starters.ts       ← REWRITE: 3 V2 template slugs only
│   ├── contracts.ts      ← REWRITE: V2 generation flow
│   ├── importDetect.ts   ← NEW: unified source detection
│   ├── hubspot.ts        ← NEW: deal import + field mapping
│   ├── driveImport.ts    ← NEW: text extraction + pattern matching
│   └── docusign.ts       ← NEW: mock envelope builder
├── routes/
│   ├── contracts.ts      ← REWRITE: V2 routes only
│   ├── importDetect.ts   ← NEW: POST /import/detect
│   └── docusign.ts       ← NEW: POST /contracts/:id/send-for-signature
└── config.ts             ← EXTEND: add HUBSPOT_ACCESS_TOKEN, DOCUSIGN_* (optional for mock)
```

---

### 1. `exportAsPdf` — Add to `google/drive.ts`

```typescript
export async function exportAsPdf(
  userId: string,
  fileId: string,
): Promise<Buffer> {
  const drive = driveFor(userId);
  const res = await drive.files.export(
    { fileId, mimeType: 'application/pdf' },
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(res.data as ArrayBuffer);
}
```

---

### 2. `importDetect.ts` — Unified Source Detection (New Service)

```typescript
export type ImportSource = 'hubspot' | 'drive' | 'text';

export interface ImportResult {
  fields: Partial<Record<string, string>>;
  source: ImportSource;
  label: string;
}

export async function detectAndImport(input: string): Promise<ImportResult> {
  if (input.includes('app.hubspot.com')) {
    const dealId = input.match(/deals\/(\d+)/)?.[1];
    if (!dealId) throw new Error('Could not extract HubSpot deal ID from URL');
    const result = await importFromHubSpot(dealId);
    return { ...result, source: 'hubspot' };
  }
  if (input.includes('docs.google.com')) {
    const docId = input.match(/\/d\/([\w-]+)/)?.[1];
    if (!docId) throw new Error('Could not extract Google Doc ID from URL');
    // For V2 prototype: fetch doc text via Docs API, then run extractDriveFields
    const text = await fetchDocText(docId);
    return { fields: extractDriveFields(text), source: 'drive', label: 'Google Drive Doc' };
  }
  // Raw pasted text
  return { fields: extractDriveFields(input), source: 'text', label: 'Pasted Text' };
}
```

**Route:** `POST /import/detect` → body: `{ input: string }` → returns `ImportResult`

---

### 3. `hubspot.ts` — Mock for V2 Prototype

For the demo, return hardcoded PumpWorks data. Real HubSpot API wired in post-demo.

```typescript
export async function importFromHubSpot(dealId: string): Promise<ImportResult> {
  // V2 PROTOTYPE MOCK — replace with real HubSpot API call post-demo
  return {
    fields: {
      client_legal_name: 'DXP Enterprises, Inc. dba PumpWorks',
      client_address: '1234 Industrial Blvd, Houston, TX 77001',
      client_contact_name: 'John Smith',
      client_contact_email: 'jsmith@pumpworks.com',
      softway_rep: 'Ashley Rodriguez',
      project_fee_usd: '150000',
      sow_number: 'SOW-2026-PW-01',
      contract_date: new Date().toLocaleDateString('en-US'),
    },
    source: 'hubspot',
    label: 'PumpWorks 2026 Culture Solution',
  };
}
```

---

### 4. `driveImport.ts` — Pattern Matching Text Extraction

```typescript
export function extractDriveFields(text: string): Partial<Record<string, string>> {
  const fields: Partial<Record<string, string>> = {};

  const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
  if (dateMatch) fields.event_dates = dateMatch.join(', ');

  const msaDateMatch = text.match(/MSA Effective Date:\s*(.+)/i);
  if (msaDateMatch) fields.msa_date = msaDateMatch[1].trim();

  const dollarMatch = text.match(/\$[\d,]+(\.\d{2})?/g);
  if (dollarMatch) fields.project_fee_usd = dollarMatch[0].replace(/[$,]/g, '');

  const workshopMatch = text.match(/(\d+)\s*(workshops?|sessions?)/i);
  if (workshopMatch) fields.workshop_count = workshopMatch[1];

  const attendeeMatch = text.match(/(\d+)\s*(attendees?|participants?|people)/i);
  if (attendeeMatch) fields.attendee_count = attendeeMatch[1];

  const locationMatch = text.match(/(?:location|venue|site):\s*(.+)/i);
  if (locationMatch) fields.location = locationMatch[1].trim();

  return fields;
}
```

---

### 5. `docusign.ts` — Mock Envelope Builder

```typescript
export interface DocuSignEnvelope {
  envelopeId: string;
  status: 'created' | 'sent';
  sentAt: string;
}

export async function createEnvelope(
  contractId: string,
  signerEmail: string,
  signerName: string,
  pdfBuffer: Buffer,
): Promise<DocuSignEnvelope> {
  // V2 PROTOTYPE MOCK — replace with real DocuSign eSignature API post-demo
  return {
    envelopeId: `ENV-MOCK-${Date.now()}`,
    status: 'sent',
    sentAt: new Date().toISOString(),
  };
}
```

**Route:** `POST /contracts/:id/send-for-signature`
1. Fetch contract by ID
2. Export Google Doc → PDF via `exportAsPdf()`
3. Call `createEnvelope()` with client contact + PDF
4. Update contract row: `status = 'sent'`, `docusign_envelope_id = envelope.envelopeId`
5. Return envelope confirmation

---

### 6. V2 Contract Generation Flow — `contracts.ts`

```typescript
export async function generateContractV2(
  userId: string,
  contractType: 'msa-sow' | 'sow-standalone' | 'change-order',
  fields: Record<string, string>,
): Promise<{ contractId: string; driveFileId: string; previewUrl: string }> {

  // 1. Validate — block if any required field is empty
  const missing = REQUIRED_FIELDS[contractType].filter(f => !fields[f]);
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }

  // 2. Get the correct locked template for this contract type
  const template = await getTemplateBySlug(userId, contractType);

  // 3. Copy template → new Google Doc (existing replaceVariables function)
  const driveFileId = await copyAndFillTemplate(userId, template.driveDocId, fields);

  // 4. Save contract record to DB
  const contract = await db.contracts.create({
    userId, title: fields.client_legal_name + ' — ' + contractType,
    contractType, status: 'generated',
    driveFileId, fieldValuesJson: fields,
    importSourceJson: fields._importSource || null,
  });

  return {
    contractId: contract.id,
    driveFileId,
    previewUrl: `https://docs.google.com/document/d/${driveFileId}/preview`,
  };
}

// Required fields per contract type
const REQUIRED_FIELDS = {
  'msa-sow': ['client_legal_name', 'client_address', 'client_contact_name',
              'client_contact_email', 'softway_rep', 'project_fee_usd',
              'completion_date', 'service_type'],
  'sow-standalone': ['client_legal_name', 'msa_date', 'softway_rep',
                     'project_fee_usd', 'completion_date', 'service_type'],
  'change-order': ['client_legal_name', 'sow_number', 'completion_date',
                   'project_fee_usd'],
};
```

---

## Frontend — New Files to Build

### File Structure
```
packages/web/
├── app/
│   ├── page.tsx                          ← Home: redirect to /contracts/generate
│   └── contracts/
│       ├── generate/
│       │   └── page.tsx                  ← NEW: The smart form (main UI)
│       ├── [id]/
│       │   └── review/
│       │       └── page.tsx              ← NEW: Review screen (demo money shot)
│       └── page.tsx                      ← NEW: Contracts list
├── components/
│   ├── ContractTypeSelector.tsx          ← NEW
│   ├── AddSourceBar.tsx                  ← NEW: unified import input
│   ├── SourceChip.tsx                    ← NEW: "HubSpot ✓" / "Drive ✓" chip
│   ├── SmartField.tsx                    ← NEW: field with source badge
│   ├── GenerateButton.tsx                ← NEW: with unfilled validation
│   ├── LegalLockBadge.tsx                ← NEW: "🔒 Legal Approved — Locked"
│   ├── ClauseCoverage.tsx                ← NEW: 6 green clause checkmarks
│   ├── VariableSummaryCard.tsx           ← NEW: left column on review screen
│   ├── ContractPreview.tsx               ← NEW: Google Doc iframe embed
│   └── StepIndicator.tsx                 ← NEW: Step 1 → 2 → 3 progress bar
└── lib/
    └── api.ts                            ← REWRITE: V2 endpoints only
```

---

### The Generate Page — `/contracts/generate`

**Exact UI layout top to bottom:**

```
[Step 1: Contract Type] → [Step 2: Fill Details] → [Step 3: Review & Send]
                                  ↑ active

──────────────────────────────────────────────────────────
CONTRACT TYPE                                    (Step 1)
──────────────────────────────────────────────────────────
○ MSA + SOW-01       New client — full legal package attached
○ Standalone SOW     Repeat client with existing MSA on file
○ Change Order       Scope or pricing update to an existing SOW

──────────────────────────────────────────────────────────
ADD SOURCE                                       (Step 1b)
──────────────────────────────────────────────────────────
[Paste a HubSpot deal URL, Google Drive link, or text...   ]
                                              [Add Source ↵]

[✅ HubSpot — PumpWorks 2026 ×]   ← source chip, dismissible

──────────────────────────────────────────────────────────
CONTRACT DETAILS                                 (Step 2)
──────────────────────────────────────────────────────────
Client Legal Name  [_______________] HubSpot ✓
Client Address     [_______________] HubSpot ✓
Client Contact     [_______________] HubSpot ✓
Contact Email      [_______________] HubSpot ✓
Softway Rep        [_______________] HubSpot ✓
SOW Number         [_______________] Auto ✓
Contract Date      [04/26/2026    ] Auto ✓
Total Value        [$_____________] HubSpot ✓

Service Type       [dropdown      ]
Workshop Count     [____]
Duration (hrs)     [____]
Attendee Count     [____]
Facilitator Count  [____]
Location           [_______________]
Completion Date    [_______________]
Event Dates        [_______________]
Payment Structure  [dropdown      ]
Discount Type      [dropdown      ]
Discount Amount    [$_____________]
Travel Required    [toggle        ]
Travel Cap         [$_____________]  ← show only if Travel Required = Yes
IP Transfer        [toggle        ]
Prior MSA on file? [toggle        ]
MSA Date           [_______________]  ← show only if Prior MSA = Yes

                              [Generate Contract →]
```

**Conditional fields:** `travel_cap` shows only if `travel_required = true`. `msa_date` shows only if contract type is `sow-standalone` or `prior_msa = true`.

**On Generate click:**
1. Validate all required fields for the selected contract type
2. If any required field empty → show UNFILLED badge on those fields only, scroll to first empty field, do NOT submit
3. If all fields filled → `POST /contracts/generate` → redirect to `/contracts/{id}/review`

---

### The Review Screen — `/contracts/[id]/review`

**This is the demo's money shot. Build it last, polish it most.**

```
[Step 1: Contract Type] → [Step 2: Fill Details] → [Step 3: Review & Send]
                                                            ↑ active

┌─────────────────────────┬────────────────────────────────┐
│                         │                                │
│  CONTRACT SUMMARY       │  CONTRACT PREVIEW              │
│  ─────────────────      │  ─────────────────             │
│  Client:                │  ┌──────────────────────────┐  │
│  DXP Enterprises dba    │  │  🔒 LEGAL APPROVED       │  │
│  PumpWorks              │  │      — LOCKED             │  │
│                         │  │  ─────────────────────   │  │
│  Type: MSA + SOW-01     │  │  [Google Doc preview      │  │
│  Value: $150,000        │  │   iframe embed here]      │  │
│  Rep: Ashley Rodriguez  │  │                           │  │
│  Date: 04/26/2026       │  └──────────────────────────┘  │
│  Completion: 09/30/2026 │                                │
│  SOW #: SOW-2026-PW-01  │                                │
│                         │                                │
│  ─────────────────      │                                │
│  CLAUSE COVERAGE        │                                │
│  ─────────────────      │                                │
│  ✅ Limitation of       │                                │
│     Liability           │                                │
│  ✅ Indemnification     │                                │
│  ✅ IP Ownership        │                                │
│  ✅ Termination for     │                                │
│     Convenience         │                                │
│  ✅ Governing Law       │                                │
│  ✅ Confidentiality/NDA │                                │
│                         │                                │
│  [← Edit Fields]        │  [Send to DocuSign →]          │
└─────────────────────────┴────────────────────────────────┘
```

**Clause coverage logic:** Hardcode the 6 checkmarks as present for `msa-sow` and `sow-standalone` templates (since legal approved them with all clauses). For `change-order`, show a note: *"Governed by original SOW — clauses apply."*

**On Send to DocuSign click:**
1. `POST /contracts/:id/send-for-signature`
2. Show loading state: *"Generating PDF and creating envelope..."*
3. Show success state: *"✅ Envelope created — sent to jsmith@pumpworks.com"*
4. Update contract status badge to `Sent`

---

## API Client — `packages/web/lib/api.ts`

Rewrite clean. V2 endpoints only:

```typescript
export const api = {
  // Import
  importDetect: (input: string) =>
    post<ImportResult>('/import/detect', { input }),

  // Contract generation
  generateContract: (payload: GenerateContractPayload) =>
    post<{ contractId: string; driveFileId: string; previewUrl: string }>('/contracts/generate', payload),

  // Contract retrieval
  getContract: (id: string) =>
    get<Contract>(`/contracts/${id}`),

  listContracts: () =>
    get<Contract[]>('/contracts'),

  // DocuSign
  sendForSignature: (contractId: string) =>
    post<DocuSignEnvelope>(`/contracts/${contractId}/send-for-signature`, {}),
};
```

---

## Shared Types — `packages/shared/src/index.ts`

```typescript
export type ContractType = 'msa-sow' | 'sow-standalone' | 'change-order';
export type ContractStatus = 'draft' | 'generated' | 'sent' | 'signed';
export type ImportSource = 'hubspot' | 'drive' | 'text';

export interface Contract {
  id: string;
  userId: string;
  title: string;
  contractType: ContractType;
  status: ContractStatus;
  driveFileId?: string;
  pdfDriveFileId?: string;
  docusignEnvelopeId?: string;
  importSourceJson?: { source: ImportSource; label: string; importedAt: string };
  fieldValuesJson?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ImportResult {
  fields: Partial<Record<string, string>>;
  source: ImportSource;
  label: string;
}

export interface GenerateContractPayload {
  contractType: ContractType;
  fields: Record<string, string>;
}

export interface DocuSignEnvelope {
  envelopeId: string;
  status: 'created' | 'sent';
  sentAt: string;
}
```

---

## Error States — Required Before Demo

These must all be handled. An unhandled failure in a live demo kills credibility.

| Scenario | Expected Behavior |
|---|---|
| Required field empty on Generate | UNFILLED badge on empty fields only, scroll to first, do NOT submit |
| HubSpot import returns partial data | Fill what was returned, leave rest empty with subtle yellow tint, no crash |
| Paste input not recognized | Show: *"Couldn't detect source — fields not filled. Fill manually."* No crash |
| PDF export fails | Save contract record anyway, show: *"PDF export failed — open in Drive instead"* with Drive link |
| DocuSign mock fails | Show: *"DocuSign unavailable — contract saved to Drive. Send manually."* Contract is never lost |

---

## Build Order — Start Here

| # | Task | File(s) | Est. Time |
|---|---|---|---|
| 1 | Archive V1, set up clean branch | git commands | 10 min |
| 2 | Write fresh DB schema | `schema.sql` | 30 min |
| 3 | Write shared types | `shared/src/index.ts` | 30 min |
| 4 | Add `exportAsPdf` to drive client | `google/drive.ts` | 30 min |
| 5 | Build `importDetect` service + route | `services/importDetect.ts`, `routes/importDetect.ts` | 1 hr |
| 6 | Build HubSpot mock service | `services/hubspot.ts` | 30 min |
| 7 | Build Drive text extraction service | `services/driveImport.ts` | 1 hr |
| 8 | Rewrite `contracts.ts` with V2 generation flow | `services/contracts.ts` | 1.5 hr |
| 9 | Build DocuSign mock + route | `services/docusign.ts`, `routes/docusign.ts` | 1 hr |
| 10 | Rewrite API client | `web/lib/api.ts` | 30 min |
| 11 | Build Generate page | `web/app/contracts/generate/page.tsx` | 3 hr |
| 12 | Build Review screen | `web/app/contracts/[id]/review/page.tsx` | 2.5 hr |
| 13 | Wire error states across all components | Multiple files | 1.5 hr |
| 14 | End-to-end test with PumpWorks mock data | Manual | 1 hr |
| 15 | Polish Review screen — lock badge + clause checks | `LegalLockBadge.tsx`, `ClauseCoverage.tsx` | 1 hr |

**Total: ~16 hours of focused work**

---

## Demo Test — The 3-Minute Sequence

Run this exact flow to verify the prototype is demo-ready:

1. Open `localhost:3000/contracts/generate`
2. Select **MSA + SOW-01**
3. Paste `https://app.hubspot.com/contacts/deals/123` into Add Source → click Add Source
4. Verify 8 fields fill with `HubSpot ✓` badges
5. Fill remaining fields manually (workshop count, dates, location, etc.)
6. Click **Generate Contract** → verify redirect to review screen
7. Verify: all 22 values in left column, no `{{variable}}` text visible
8. Verify: `🔒 Legal Approved — Locked` banner visible
9. Verify: all 6 clause checkmarks green
10. Click **Send to DocuSign** → verify mock confirmation

**Go/No-Go Checklist — PDF Output:**
- [ ] Zero `{{unfilled}}` variables in the generated PDF
- [ ] Client name reads `DXP Enterprises, Inc. dba PumpWorks`
- [ ] Total value reads `$150,000`
- [ ] All 6 legal clauses present in document body
- [ ] Signature block correct on both sides
- [ ] No broken formatting or orphaned template lines

If the PDF passes this checklist — the prototype is demo-ready.

---

## What Comes After the Demo (Not in V2 Scope)

- **Real HubSpot API** — swap mock for live Private App token
- **Real DocuSign API** — swap mock for sandbox credentials
- **Google Drive scope upgrade** — add `drive.readonly` for direct doc import
- **Layer 3 AI** — wire existing Gemini service for clause gap detection and inconsistency checking
- **Contracts list page** — history of all generated contracts with status tracking
- **Approval routing** — deals over $25k route to legal review before DocuSign send

---

*Softway ContractGen V2 · Intern Tiger Team · Sprint 3 · April 2026*
