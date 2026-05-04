import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { config } from '../config.js';
import type {
  ChatMessage,
  RedlineClause,
  RiskFlag,
} from '@cg/shared';

const client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
const MODEL = config.ANTHROPIC_MODEL;

// --------------------------------------------------------------------------
// Error handling
// --------------------------------------------------------------------------

export class AiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

function handleAnthropicError(err: unknown): never {
  if (err instanceof Anthropic.RateLimitError) {
    throw new AiError(429, 'AI rate limit reached — please try again in a moment');
  }
  if (err instanceof Anthropic.AuthenticationError) {
    throw new AiError(401, 'AI service authentication failed — check ANTHROPIC_API_KEY');
  }
  if (err instanceof Anthropic.APIConnectionError) {
    throw new AiError(503, 'Could not connect to AI service');
  }
  if (err instanceof Anthropic.APIError) {
    throw new AiError(502, `AI service error: ${err.message}`);
  }
  throw err;
}

// --------------------------------------------------------------------------
// Structured output schemas
// --------------------------------------------------------------------------

const IntakeOutputSchema = z.object({
  reply: z.string(),
  fields: z.record(z.string()).optional(),
  ready: z.boolean().optional(),
});

const ReviewOutputSchema = z.object({
  reply: z.string(),
  patch: z.object({ field: z.string(), newValue: z.string() }).optional(),
  edited: z.boolean().optional(),
});

const RedlineOutputSchema = z.object({
  clauses: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      verdict: z.enum(['safe', 'review', 'conflict']),
      explanation: z.string(),
    }),
  ),
});

const MSAOutputSchema = z.object({
  risks: z.array(
    z.object({
      clauseName: z.string(),
      risk: z.string(),
      softwayVersion: z.string(),
    }),
  ),
  sowDraft: z.string(),
});

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function cachedSystem(text: string) {
  return [{ type: 'text' as const, text, cache_control: { type: 'ephemeral' as const } }];
}

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}

function parseJson<T>(text: string, schema: z.ZodType<T>): T | null {
  try {
    const result = schema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// System prompts
// --------------------------------------------------------------------------

const INTAKE_SYSTEM = `You are ContractGen, an AI assistant helping Softway Solutions build contracts.
Your job is to collect the required fields for a contract through natural conversation.

Supported contract types: msa-sow, sow-standalone, change-order.
Do NOT offer or accept nda or employment-contract — those are not supported.

Required fields for ALL types:
- client_legal_name: Full legal name of the client company
- client_office_address: Client's registered office address
- softway_rep: Softway account representative name
- project_fee_usd: Total project fee in USD (numbers only, no $ sign, no commas)
- completion_date: Project completion date (YYYY-MM-DD format)
- service_type: Description of services being provided

Additional required fields for msa-sow:
- effective_date: MSA effective date (YYYY-MM-DD)
- client_contact_name: Primary contact person name
- client_contact_email: Primary contact email
- client_signatory_name: Name of the person signing for the client
- client_signatory_title: Title of the person signing for the client

Additional required fields for sow-standalone:
- msa_date: Date of the existing MSA (YYYY-MM-DD)
- sow_number: SOW number (e.g. "001" or "SOW-001")

Additional required fields for change-order:
- sow_number: SOW number being changed
- change_description: Description of what is changing
- original_fee_usd: Original project fee (numbers only, no $ sign)

Optional fields (collect if mentioned):
- payment_structure: Payment terms (e.g. "50% on signing, 50% on completion, Net 30")
- location: Location where services will be delivered
- travel_required: Whether travel is required (Yes or No)
- travel_cap: Travel expense cap in USD (numbers only)
- workshop_count: Number of workshops
- attendee_count: Expected number of attendees
- facilitator_count: Number of facilitators
- duration_hrs: Duration per workshop in hours
- signature_date: Date of signing (YYYY-MM-DD)

Rules:
1. Ask ONE question at a time — never a form
2. Confirm extracted values before moving on
3. When the user pastes raw text, extract all available fields from it and confirm each
4. Use option chips notation for bounded answers: [CHIPS: option1 | option2 | option3] at the end of your message
5. When all required fields for the selected contract type are collected, say "Looks good — ready to generate your contract?" and set ready=true
6. Respond ONLY in JSON: { "reply": "...", "fields": { "field_name": "value" }, "ready": false }
7. Only include fields in "fields" that were newly confirmed in this turn
8. All dates must be YYYY-MM-DD format
9. project_fee_usd and original_fee_usd: numbers only, no $ or commas`;

const REVIEW_SYSTEM = `You are ContractGen's contract assistant. You help users review and edit their contract.
The contract's current field values are provided as key: value pairs.

For edit commands (change fee, update timeline, extend deadline, modify name, etc.):
- Identify which field the user wants to change and the new value
- Reply: { "reply": "Done — updated the fee to $120,000.", "patch": { "field": "project_fee_usd", "newValue": "120000" }, "edited": true }

For questions about the contract:
- Reply: { "reply": "...", "edited": false }

Known field keys: client_legal_name, client_office_address, project_fee_usd, completion_date,
service_type, softway_rep, client_contact_name, client_contact_email, effective_date,
payment_structure, location, travel_required, travel_cap, sow_number, signature_date,
change_description, original_fee_usd, client_signatory_name, client_signatory_title

Rules:
- project_fee_usd and original_fee_usd: numbers only, no $ or commas
- dates: YYYY-MM-DD format
- Keep replies short and direct
- Always return valid JSON`;

const REDLINE_SYSTEM = `You are a contract attorney reviewing a client's redlined version of Softway Solutions' contract.
Analyse each modified clause and return a JSON array. For each clause:
- verdict: "safe" (accept as-is), "review" (needs human review), or "conflict" (conflicts with Softway standard)
- explanation: 1-2 sentence plain-English explanation of the risk or reason
Return JSON: { "clauses": [ { "id": "1", "name": "Clause Name", "verdict": "safe|review|conflict", "explanation": "..." }, ... ] }`;

const CLIENT_MSA_SYSTEM = `You are a contract attorney helping Softway Solutions build a SOW to work within a client's MSA.
Read the client's MSA, identify risks, and draft Softway's protective SOW language.
Return JSON:
{
  "risks": [
    { "clauseName": "Payment Terms", "risk": "Net-60 payment terms exceed Softway's Net-30 standard", "softwayVersion": "Payment due Net-30 from invoice date" }
  ],
  "sowDraft": "Full draft SOW text here with Softway's protective language..."
}`;

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export async function intakeChat(
  history: ChatMessage[],
  message: string,
): Promise<{ reply: string; fields: Record<string, string>; ready: boolean }> {
  try {
    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: message },
    ];

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: cachedSystem(INTAKE_SYSTEM),
      messages,
    });

    const text = extractText(response);
    const parsed = parseJson(text, IntakeOutputSchema);
    if (parsed) return { reply: parsed.reply, fields: parsed.fields ?? {}, ready: parsed.ready ?? false };
    return { reply: text, fields: {}, ready: false };
  } catch (err) {
    handleAnthropicError(err);
  }
}

export async function reviewChat(
  fields: Record<string, string>,
  message: string,
): Promise<{ reply: string; patch?: { field: string; newValue: string }; edited: boolean }> {
  try {
    const fieldContext = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: cachedSystem(REVIEW_SYSTEM),
      messages: [
        {
          role: 'user',
          content: `Current contract fields:\n${fieldContext}\n\nUser instruction: ${message}`,
        },
      ],
    });

    const text = extractText(response);
    const parsed = parseJson(text, ReviewOutputSchema);
    if (parsed) return { reply: parsed.reply, patch: parsed.patch, edited: parsed.edited ?? false };
    return { reply: text, edited: false };
  } catch (err) {
    handleAnthropicError(err);
  }
}

export async function verifyClauseCoverage(
  renderedHtml: string,
  clauses: Array<{ id: string; name: string; body: string; type: string }>,
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  const htmlLower = renderedHtml.toLowerCase();
  for (const clause of clauses) {
    if (clause.type === 'non-negotiable') {
      const keyPhrase = clause.body.slice(0, 30).toLowerCase();
      results[clause.id] = htmlLower.includes(keyPhrase);
    } else {
      results[clause.id] = true;
    }
  }
  return results;
}

export async function analyzeRedlines(docText: string): Promise<RedlineClause[]> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'enabled', budget_tokens: 5000 },
      system: cachedSystem(REDLINE_SYSTEM),
      messages: [
        {
          role: 'user',
          content: `Analyse this redlined contract and identify every modified clause:\n\n${docText.slice(0, 8000)}`,
        },
      ],
    });

    const text = extractText(response);
    const parsed = parseJson(text, RedlineOutputSchema);
    if (!parsed) return [];

    return parsed.clauses.map((c, i) => ({
      id: c.id || String(i + 1),
      name: c.name || `Clause ${i + 1}`,
      verdict: c.verdict,
      explanation: c.explanation,
    }));
  } catch (err) {
    handleAnthropicError(err);
  }
}

export async function analyzeClientMSA(
  docText: string,
): Promise<{ risks: RiskFlag[]; sowDraft: string }> {
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'enabled', budget_tokens: 8000 },
      system: cachedSystem(CLIENT_MSA_SYSTEM),
      messages: [
        {
          role: 'user',
          content: `Client MSA to analyse:\n\n${docText.slice(0, 8000)}`,
        },
      ],
    });

    const response = await stream.finalMessage();
    const text = extractText(response);
    const parsed = parseJson(text, MSAOutputSchema);
    if (parsed) return parsed;
    return { risks: [], sowDraft: '' };
  } catch (err) {
    handleAnthropicError(err);
  }
}
