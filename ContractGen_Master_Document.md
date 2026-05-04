# ContractGen — Master Project Document
**Softway Tiger Team | Spring 2026 Intern Project**
*Complete reference for System Architecture, User Journeys, Visual Explanation, and Project Scope*

---

## Executive Summary

ContractGen is an AI-powered contract generation and management tool built to solve Softway's broken contract process. Today, generating a single contract takes 4–6 hours across 2–3 people, involves piecing together language from old deals, and creates version sprawl with no single source of truth. ContractGen eliminates manual assembly, standardises legal language, catches contractual risk, and closes the loop all the way to DocuSign and HubSpot automatically.

The tool is built on three intelligence layers — LLM, Template, and Integration — and surfaces through a Google Docs-style interface powered by Claude's conversational AI. The prototype covers four user journeys across six screens and is designed for live demo to Chris Pitre, Lacee Maxedon, and Ashley Ward in the first week of May 2026.

**One-liner:** Claude for the conversational intelligence. Google Docs for the live document experience. = A contract generator that standardises language, eliminates manual assembly, catches legal risk, and closes the loop to DocuSign and HubSpot automatically.

---

# Part 1 — System Architecture

## The Three Layers

ContractGen is built on three distinct layers. Every user action passes through all three, in sequence.

### Layer 1 — LLM Layer (Intelligence Backbone)

The LLM layer is the intelligence core of ContractGen. It handles everything that requires understanding, extraction, generation, and judgment.

**Responsibilities:**
- **Database/Memory** — Stores and retrieves past contract data, client history, and field values for same-client reference on future contracts
- **Extraction** — Reads pasted HubSpot URLs, Google Drive links, or uploaded client documents and extracts structured field values (client name, fee, scope, timeline, governing law, etc.)
- **Generation** — Populates contract templates with extracted + confirmed field values, producing a complete, legally sound draft
- **Edit** — Processes plain-English chat commands ("change the fee to $120k", "extend the timeline by 30 days") and updates the live Google Doc in real time
- **Legal Review** — Analyses uploaded client documents clause by clause, assigns 🟢🟡🔴 risk verdicts, explains flags in plain English, and confirms critical extractions before locking them in

The LLM layer runs behind every single user journey. It is never exposed directly — users interact with it through the conversational intake screen and the chat input on the Review Screen.

### Layer 2 — Template Layer (Structural Output)

The Template layer is the skeleton of every contract ContractGen produces. The LLM fills templates; templates govern what the LLM can and cannot produce.

**Responsibilities:**
- **Template Creation** — Admin-managed. Templates define the structure, section order, and clause slots for each contract type (MSA, SOW, NDA, Service Agreement, Employment Contract)
- **Template Generation** — When a user selects a template, it pre-populates the contract structure and skips intake questions for fields the template already answers
- **Template Edit** — Templates can be updated by admins. Changes propagate to all future contracts generated from that template
- **Admin Panel** — The home of the Template layer. Contains the Clause Library (every clause used across all templates), clause types (Non-Negotiable / Flexible / Optional), version history, and inline editing

**Clause Library** is the most critical component of the Template layer. It is the single source of truth for all legal language Softway uses. Every clause in every contract traces back to a row in the Clause Library. When a clause is edited and saved, all future contracts auto-use the new version silently.

### Layer 3 — Integration Layer (Connected Systems)

The Integration layer connects ContractGen to every external system it depends on. For the prototype, all integrations are flat — all users have equal access.

| Integration | Role |
|---|---|
| **HubSpot** | Source for client data auto-extraction during intake. Webhook receiver: when a contract is Signed, HubSpot deal auto-updates to Closed Won |
| **Google Drive** | Storage layer for all generated contracts as live Google Docs. Enables real-time editing, internal sharing, and the iframe embed on the Review Screen |
| **DocuSign** | Signature dispatch and tracking. Contracts are sent to DocuSign only when all clause checks pass. Recall triggers a DocuSign void |
| **Notes** | Internal annotation layer. Used to log override reasons, flag resolutions, and clause-level decisions for audit trail |

---

## Data Flow — End to End

```
User Action (Homepage)
        ↓
Conversational Intake / Upload
        ↓
LLM Layer — Extraction + Question-by-question confirmation
        ↓
Template Layer — Template selected, structure populated
        ↓
Google Drive — Live Google Doc created, iframe embedded in Review Screen
        ↓
Review Screen — User confirms fields, resolves flags, edits via chat
        ↓
All clause checks pass → DocuSign button activates
        ↓
DocuSign — Sent for signature, contract locked from edits
        ↓
Webhook fires on Signing → HubSpot deal → Closed Won
        ↓
Contract Vault — Immutable archive, referenced for future same-client contracts
```

---

## Contract Lifecycle — State Machine

```
Draft → In Review → Sent → Signed → Closed
  ↑__________________________|
         Recall (before Signed)
```

| State | Description | User Actions Available |
|---|---|---|
| **Draft** | Being built. Auto-saves every edit | Continue, Delete |
| **In Review** | On Review Screen. Google Doc shareable internally | Edit, Share, Send to DocuSign |
| **Sent** | Dispatched via DocuSign. Locked from edits | Recall, Send Reminder |
| **Signed** | Webhook fires. HubSpot auto-updates to Closed Won | View, Archive |
| **Closed** | Immutable. Archived in Contract Vault | View only |
| **Recalled** | Voided via DocuSign. Reason logged. Reverts to Draft | Restart from Draft |

---

## Notifications — Action-Driven Only

No passive notifications. Every notification requires an action.

| Trigger | In-App + Email Message | One-Click Action |
|---|---|---|
| Client signs contract | "[Client] [Contract Type] — signed by both parties" | View Contract |
| Contract in Sent state 5+ days unsigned | "[Contract] — no response in 5 days" | Send DocuSign Reminder |
| Contract recalled | "[Contract] recalled by [Name]" | View Details |

HubSpot update on signing is automatic — no notification, no user action required.

---

# Part 2 — User Journeys (All)

## Journey 1 — New Client (Conversational Intake)

**Entry point:** Homepage → ➕ New Contract

**Who uses this:** Any team member creating a contract for a client not yet in the system, or where no template pre-answers the required fields.

**Step-by-step flow:**

1. User clicks **➕ New Contract** on the homepage
2. Conversational intake screen opens — clean centered column, chat-style
3. AI opens with: *"Let's build your contract. Who's the client?"*
4. User types a response. AI confirms and moves to the next question
5. If the user pastes a HubSpot URL or Google Drive link, the LLM auto-extracts all available fields and confirms each one: *"I found Horizon Retail Pvt. Ltd. — is that right?"*
6. Inline option chips appear when the user hesitates or the question has bounded answers (e.g. contract type chips: MSA / SOW / NDA / Other; attendee count chips: Under 50 / 50–100 / 100+)
7. A **background checklist panel** slides in from the right after the first question is answered. It tracks all required fields in real time: ✅ Client Name, ✅ Contract Type, ⬜ Scope, ⬜ Fee, ⬜ Timeline...
8. The progress bar at the top updates continuously: "12 of 22 fields captured"
9. When all required fields are filled, AI says: *"Looks good — ready to generate your contract?"*
10. User confirms → **Review Screen opens (J1/J2 version)**

**Key UX decisions:**
- One question at a time — never a form
- Option chips appear only when the user is stuck or the answer is bounded — not by default
- Auto-extraction from HubSpot/GDrive removes the need to re-enter known data
- Background checklist is always visible but never interrupts the conversation

---

## Journey 2 — Template (Pre-filled Intake)

**Entry point:** Homepage → Template Gallery → Select a template

**Who uses this:** Any team member who knows which contract type they need and wants the structure pre-decided.

**Step-by-step flow:**

1. User clicks **Template Gallery** on the homepage
2. Gallery overlay opens with search bar + filters (All Contract Types / All Industries)
3. Templates available: NDA, Service Agreement, SOW, MSA, Employment Contract, View All
4. User selects a template (e.g. SOW)
5. Same conversational intake screen opens — but with key differences:
   - Template pre-selects contract type and structure
   - Fields the template already answers are shown as pre-checked ✅ in the background checklist
   - AI skips those fields and only asks for missing ones
   - Intake is shorter — fewer questions, faster to Review Screen
6. AI confirms: *"Ready to generate your SOW?"*
7. **Review Screen opens (J1/J2 version)**

**Key UX decisions:**
- Template path reuses the same conversational intake engine — no separate form UI
- Template swap is available on the Review Screen if the user realises mid-way they chose the wrong type
- Field values carry over when swapping templates — no re-entry required
- Warning shown if the new template requires an MSA clause that the current intake didn't capture

---

## Journey 3A — Client Redlines Softway's Contract

**Entry point:** Homepage → ⬆️ Upload Client Document → client's redlined version of a Softway contract

**Who uses this:** Lacee or Ashley when a client has returned Softway's own contract with tracked changes and proposed edits.

**Step-by-step flow:**

1. User clicks **⬆️ Upload Client Document** (top right of homepage — visually separate from New Contract flow)
2. Upload modal opens. User uploads the client's redlined document
3. AI auto-starts analysis immediately after upload — no manual trigger
4. **Review Screen (J3A version) opens:**

   **Left panel — Redline Analysis:**
   - Clauses grouped by verdict:
     - 🟢 **Safe to Accept** (with count badge)
     - 🟡 **Needs Review** (with count badge)
     - 🔴 **Conflicts with Softway Standard** (with count badge)
   - Each clause expandable — shows clause name + AI's plain-English explanation
   - Three action buttons per clause: **Accept / Reject / Counter**
   - Progress indicator: "8 of 12 clauses resolved"
   - 🔴 overrides require a written reason (logged, visible in admin audit trail)
   - **Finalize Document** button greyed out with tooltip: "Resolve all flagged items to enable"

   **Right panel:**
   - Client's redlined Google Doc in iframe — tracked changes fully visible (strikethrough red = deleted, underline green = added)

   **Bottom:**
   - Chat input: *"Ask about any flagged clause..."*
   - *"Why is Clause 7 flagged red?"* → AI explains in plain English
   - *"What's our standard language for this?"* → AI retrieves Softway's clause from the Clause Library

5. Lacee resolves all flags → **Finalize Document** activates
6. Finalize → AI auto-cleans all tracked changes → produces clean final document → routes to DocuSign

---

## Journey 3B — Client Sends Their Own MSA

**Entry point:** Homepage → ⬆️ Upload Client Document → client's own MSA

**Who uses this:** Lacee or Ashley when a client has sent their own Master Services Agreement and Softway needs to build a SOW that works within it, or negotiate from the client's baseline.

**Step-by-step flow:**

1. User clicks **⬆️ Upload Client Document**
2. User uploads the client's own MSA
3. AI reads the full document, flags risky terms, and builds Softway's SOW around the client's language
4. **Review Screen (J3B version) opens — Split Diff View:**

   **Left panel — Client MSA:**
   - Client's MSA rendered section by section
   - Risk flags highlighted inline (🟡 warning highlight on flagged clauses)
   - Risk flags panel above: e.g. "3 risk flags identified in client MSA — review before finalizing"

   **Right panel — Softway SOW Generated:**
   - Softway's SOW built to work within the client's MSA
   - ✅ green highlights on Softway's corrected or protected versions of flagged clauses
   - Governing law, payment terms, liability cap all visible with Softway's language

   **Bottom chat:**
   - AI confirms critical extractions: *"I read their payment terms as Net-60 — confirming this before I lock it in?"*
   - User approves or corrects each extraction
   - *"What's the risk with Clause 4?"* → AI explains

5. All risk flags addressed, critical extractions confirmed
6. Override with reason for any accepted risk (logged)
7. **Finalize → DocuSign**

---

## Supporting Flows

### Recall Flow
- Available from Contract Vault on any contract in Sent state
- User clicks Recall → Reason modal appears → User enters reason → DocuSign void API called → Contract status reverts to Draft → All relevant parties notified

### Admin Clause Edit Flow
- Admin opens Settings & Standards → Clause Library
- Clicks Edit on any clause → Full text opens in right panel with rich text editor
- Makes changes inline → Saves → Version history silently updated → All future contracts auto-use new clause text
- Last edited by + timestamp shown. View edit history available.

### Notification Reminder Flow
- Contract in Sent state for 5+ days → Notification appears in bell icon
- User clicks notification → One-click DocuSign reminder sent to client → Timestamp logged

---

# Part 3 — Visual Explanation

## Screen 1 — Homepage

**Purpose:** Command centre. Entry point for all four journeys.

**Layout:** Google Docs-style. White surface, left sidebar navigation, content area.

**Left sidebar navigation:**
- Home (active)
- Contract Vault
- Settings & Standards

**Top bar:**
- ContractGen logo (top left)
- 🔔 Bell icon (top right)
- 👤 Profile avatar (top right)

**Content area — top section ("Start Something New"):**
- ➕ **New Contract** card (large, left-aligned) — "Create a new contract from scratch"
- **Template Gallery panel** (right of New Contract card) — search bar + filter dropdowns (All Contract Types / All Industries) + template cards: NDA, Service Agreement, SOW, MSA, View All
- **⬆️ Upload Client Document** button — top right of content area, ghost style, visually separated from the creation flow

**Content area — bottom section ("Recent Contracts"):**
- Grid of contract cards (2 rows × 4 columns shown)
- Each card: Client name (bold), Contract type, Status badge (Draft / In Review / Completed), Last modified date, **Open** button
- Status badge colours: Draft = neutral grey, In Review = yellow/amber, Completed = green

**What's missing in current build (to add):**
- Search bar + filter chips above Recent Contracts grid

---

## Screen 2 — Conversational Intake

**Purpose:** AI-driven field capture. Replaces every intake form.

**Layout:** Full-width content area. Sidebar navigation visible. Progress bar at top.

**Top:**
- Progress bar: "12 of 22 fields captured" — updates in real time as fields are confirmed

**Chat area:**
- AI messages: left-aligned, grey bubble, robot avatar (to be replaced with ContractGen logo mark), timestamp
- User messages: right-aligned, blue bubble, timestamp + double tick
- Inline option chips below AI question when bounded answers available (Under 50 / 50–100 / 100+)

**Bottom:**
- Text input: "Type or choose an option..." with 📎 attachment icon and ➤ send icon

**Background checklist panel (slides in after first field confirmed):**
- Lists all 22 fields
- ✅ = confirmed, ⬜ = pending
- Collapsible (chevron toggle top right)

---

## Screen 3 — Review Screen (Journey 1/2)

**Purpose:** Final confirmation, live editing, and signature dispatch. The centrepiece of the product.

**Layout:** Left panel (field values + clause checks) + Right panel (Google Doc iframe) + Bottom chat.

**Top banner:**
- 🔒 "MSA Clauses Locked — Legal Approved" — amber/cream banner. Trust signal.

**Left panel:**
- **Contract Details** section: all field values (Client Name, Engagement Type, Fee, Start Date, Location, Payment Terms, IP Ownership) — each with a ✏️ edit pencil for inline correction
- **Clause Checks** section: ✅ IP Protection, ✅ Termination Clause, ✅ Liability Cap, ✅ Governing Law, ✅ Confidentiality, ✅ Payment Terms
- 🔒 Locked clause padlock icons (to be added per individual clause in left panel)
- **Send to DocuSign** button — full width, blue, active only when all ✅ checks pass

**Right panel:**
- Google Doc iframe: real document rendering with ContractGen Docs toolbar (File, Edit, View, Insert, Format, Tools, Extensions, Help), formatting bar, ruler
- Document shows full contract text, scrollable

**Bottom:**
- Chat input: "Make a change... e.g. Change the fee to $120k"
- ✨ AI icon left of input

---

## Screen 4 — Review Screen (Journey 3A — Redlines)

**Purpose:** Clause-by-clause redline resolution before finalising.

**Layout:** Left panel (Redline Analysis verdict list) + Right panel (client's redlined Google Doc) + Bottom chat.

**Left panel — Redline Analysis:**
- "Redline Analysis" header with ℹ️ info icon
- Three grouped sections with count badges:
  - 🟢 **Safe to Accept** (2)
  - 🟡 **Needs Review** (1)
  - 🔴 **Conflicts with Softway Standard** (1)
- Each clause row: clause number + name, explanation text, Accept / Reject / Counter buttons
- **Finalize Document** — greyed, full width, with lock icon. "Resolve all flagged items to enable" below it

**Right panel:**
- Client's redlined Google Doc iframe — tracked changes visible: strikethrough red (deleted), underline green (added), blue text (inserted)
- Full Google Docs toolbar visible (File, Edit, View, etc.)

**Bottom:**
- Chat input: "Ask about any flagged clause..."

---

## Screen 5 — Review Screen (Journey 3B — Split Diff)

**Purpose:** Side-by-side comparison of client MSA vs Softway's generated SOW.

**Layout:** Two equal-width panels side by side + bottom chat. No left sidebar — full width used.

**Top banner:**
- ⚠️ "3 risk flags identified in client MSA — review before finalizing" — amber banner, full width

**Left panel — Client MSA — PumpWorks:**
- "View: All" dropdown top right
- Contract sections numbered (Services, Fees and Payment, Termination, Limitation of Liability, Intellectual Property, Governing Law)
- Flagged clauses highlighted with 🟡 amber warning box around the clause text
- Unflagged clauses shown normally

**Centre divider:**
- Thin vertical line with a ↔ drag handle

**Right panel — Softway SOW — Generated:**
- "View: All" dropdown top right
- Matching section numbers
- Softway's version of flagged clauses shown with ✅ green highlight — protected/corrected language
- Clean, no tracked changes

**Bottom:**
- Chat input: "Ask about any risk flag or confirm extracted values..."
- ✨ AI icon left of input

---

## Screen 6 — Admin Panel (Settings & Standards)

**Purpose:** Governance layer. Clause Library + Contract Vault + Integrations management.

**Layout:** Left sidebar navigation + centre table + right slide-out panel.

**Three tabs:**
- **Clause Library** (active)
- **Contract Vault**
- **Integrations**

**Clause Library table:**

| Clause Name | Type | Last Updated | Updated By | Actions |
|---|---|---|---|---|
| IP Ownership | 🔴 Non-Negotiable | Apr 28, 2026 | Chris Pitre | Edit |
| Liability Cap | 🔴 Non-Negotiable | Apr 24, 2026 | Chris Pitre | Edit |
| Payment Terms | 🟡 Flexible | Apr 20, 2026 | Melissa Grant | Edit |
| Confidentiality | 🔴 Non-Negotiable | Apr 18, 2026 | Chris Pitre | Edit |
| Travel & Expenses | 🟢 Optional | Apr 15, 2026 | Alex Rivera | Edit |

**Right slide-out panel (on Edit click):**
- Clause name header (e.g. "IP Ownership")
- Type badge (Non-Negotiable)
- Short description text
- **Clause Text** section with rich text editor (Normal style / B / I / U / bullets / indent / link toolbar)
- Full clause text editable inline
- **Save Changes** button (blue, full width)
- "Last edited by Chris Pitre, Apr 28 2026" with clock icon
- "View edit history" link with refresh icon

---

# Part 4 — Project Scope

## In Scope for Demo

### Screens (6)
1. Homepage — Google Docs-style layout, New Contract, Template Gallery, Upload, Recent Contracts grid
2. Conversational Intake — AI-driven, progress bar, option chips, auto-extraction hint
3. Review Screen J1/J2 — Field values, clause checks, Google Doc iframe, chat, Send to DocuSign
4. Review Screen J3A — Redline Analysis verdict panel, tracked changes iframe, chat, Finalize
5. Review Screen J3B — Split diff view, risk flags banner, chat, Finalize
6. Admin Panel — Clause Library table, inline editor, Contract Vault, Integrations tabs

### Journeys (4)
1. New Client — Conversational intake → Review Screen
2. Template — Gallery → Pre-filled intake → Review Screen
3A. Client Redlines — Upload → Verdict panel → Resolve → DocuSign
3B. Client MSA — Upload → Split diff → SOW built → DocuSign

### Integrations (simulated for prototype)
- HubSpot auto-extraction (simulated with sample data)
- Google Drive / Google Doc iframe (live embed)
- DocuSign send flow (simulated button state)
- HubSpot Closed Won webhook (described, not live)

### Clause Library (5 placeholder clauses)
- IP Ownership (Non-Negotiable)
- Liability Cap (Non-Negotiable)
- Payment Terms (Flexible)
- Confidentiality (Non-Negotiable)
- Travel & Expenses (Optional)

---

## Parked for Post-Demo 🅿️

| Item | Priority | Action Required |
|---|---|---|
| Full 22 intake fields | 🔴 High | Validate complete field list with Chris and Lacee before or after demo |
| Legal approval step | 🔴 High | Ask Chris directly: does a lawyer review before DocuSign is sent? |
| Locked vs. unlockable MSA clauses | 🟡 Medium | Demo with all MSA clauses locked. Revisit granularity post-demo |
| Real clause library content | 🟡 Medium | 5 placeholders sufficient for demo. Real legal content needed post-demo |
| 3A vs. 3B frequency | 🟡 Low | Doesn't affect demo scope or flow. Inform prioritisation post-launch |
| Role-based access | 🟡 Medium | Flat access for prototype. Admin vs. user permissions post-demo |
| Contract Vault full build | 🟡 Medium | Basic vault in Admin Panel tab. Full search + filter vault post-demo |
| Renewal / expiry management | 🟢 Low | Not in core demo scope. Future lifecycle feature |
| Analytics / reporting | 🟢 Low | Not in core demo scope. Future operations feature |

---

## The Problem Being Solved

**Current state (before ContractGen):**
- Single contract takes 4–6 hours across 2–3 people, not including review time
- Contracts built by piecing together language from previous deals
- Version sprawl: multiple outdated versions with differing legal language actively in use
- Old addresses, incorrect information present in live contracts
- No single source of truth
- Bottleneck funnels all contract work to Chris, Lacee, and Ashley
- Delayed contracts push back project kickoffs and contribute to accrual slippage

**After ContractGen:**
- Contract generation time: minutes, not hours
- Standardised language enforced through the Clause Library — one source of truth
- Legal risk caught automatically (redline analysis, clause checks)
- DocuSign only available when all checks pass — no incomplete contracts sent
- HubSpot closes automatically on signing — no manual CRM update
- Any team member can generate a contract — not just the three named stakeholders

---

## Demo Success Criteria

The Softway playbook defines one metric: **"A rough prototype that makes Lacee say 'I need this tomorrow' is worth more than a perfectly engineered system no one has tested."**

The demo succeeds if:
- It actually works live, without guiding the audience through it
- It solves the specific pain: inconsistent contracts, hours of manual assembly, legal risk
- It was shaped by real user feedback (UX test sessions completed)
- The team can see themselves using it starting the next day

---

## Stakeholders

| Name | Role | Why They Matter |
|---|---|---|
| Chris Pitre | Leadership | Identified the problem. Owns the outcome. Toughest critic and biggest champion. Expects a working tool, not a pitch. |
| Lacee Maxedon | Operations | Experiences the contract pain daily. Primary user. Her reaction is the product-market fit signal. |
| Ashley Ward | Sales Operations | Involved in contract generation. Brings perspective on how the broken process affects the sales cycle and revenue timing. |

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| Intelligence | Claude (Anthropic) | Conversational intake, extraction, generation, legal review, live edits |
| Document surface | Google Docs / Google Drive | Live contract rendering, real-time editing, internal sharing |
| Signature | DocuSign | Signature dispatch, tracking, recall/void |
| CRM | HubSpot | Client data source, Closed Won webhook receiver |
| Annotation | Notes | Override reasons, audit trail, flag resolution log |

---

*Document prepared by ContractGen Tiger Team — May 2026*
*For internal use. Share with Chris Pitre, Lacee Maxedon, Ashley Ward.*
