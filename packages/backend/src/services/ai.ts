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
  edit: z.object({ find: z.string(), replace: z.string() }).optional(),
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

Required fields to collect:
- client_legal_name: Full legal name of the client company
- client_address: Client's registered address
- client_contact_name: Primary contact person name
- client_contact_email: Primary contact email
- softway_rep: Softway account representative name
- contract_type: Type of contract (msa-sow, sow-standalone, change-order, nda, employment-contract)
- project_fee_usd: Total project fee in USD (numbers only, no $ sign)
- completion_date: Project completion date (YYYY-MM-DD format)
- service_type: Description of services being provided

Optional fields (collect if mentioned):
- contract_date: Contract effective date (YYYY-MM-DD)
- msa_date: Date of existing MSA (for sow-standalone)
- sow_number: SOW number (for change-order)
- workshop_count: Number of workshops
- duration_hrs: Duration per workshop in hours
- attendee_count: Expected number of attendees
- facilitator_count: Number of facilitators
- location: Event location
- travel_required: Whether travel is required (yes/no)
- travel_cap: Travel expense cap in USD
- payment_structure: Payment terms (e.g. "50% upfront, 50% on completion")

Rules:
1. Ask ONE question at a time — never a form
2. Confirm extracted values before moving on: "I found X — is that right?"
3. When the user pastes a URL or raw text, extract all available fields from it and confirm each
4. Use option chips notation for bounded answers by including [CHIPS: option1 | option2 | option3] at the end of your message
5. When all required fields are collected, say "Looks good — ready to generate your contract?" and set ready=true
6. Respond in JSON: { "reply": "...", "fields": { "field_name": "value", ... }, "ready": false }
7. Only include fields in the JSON that were newly confirmed in this turn
8. Keep responses concise and conversational`;

const REVIEW_SYSTEM = `You are ContractGen's contract assistant. You help users review and edit their contract.
For edit commands (change fee, update timeline, modify clause text, etc.):
- Understand what change they want
- Respond with: { "reply": "Done — I've updated the fee to $120,000.", "edit": { "find": "old text", "replace": "new text" }, "edited": true }
For questions about the contract:
- Answer in plain English
- Respond with: { "reply": "...", "edited": false }
Keep responses short and direct.`;

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
  contractText: string,
  message: string,
): Promise<{ reply: string; edit?: { find: string; replace: string }; edited: boolean }> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: cachedSystem(REVIEW_SYSTEM),
      messages: [
        {
          role: 'user',
          content: `Contract text:\n${contractText.slice(0, 6000)}\n\nUser instruction: ${message}`,
        },
      ],
    });

    const text = extractText(response);
    const parsed = parseJson(text, ReviewOutputSchema);
    if (parsed) return { reply: parsed.reply, edit: parsed.edit, edited: parsed.edited ?? false };
    return { reply: text, edited: false };
  } catch (err) {
    handleAnthropicError(err);
  }
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
