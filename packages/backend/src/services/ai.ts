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
  clauseAction: z.union([
    z.object({ type: z.literal('add'), name: z.string(), body: z.string() }),
    z.object({ type: z.literal('remove'), name: z.string() }),
  ]).optional(),
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
  const block = response.content.find((b: any) => b.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}

function parseJson<T>(text: string, schema: z.ZodType<T>): T | null {
  try {
    // Try fenced block first (```json ... ```)
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenceMatch?.[1]?.trim() ?? text.trim();

    // Fall back to extracting the outermost { ... } or [ ... ] if candidate doesn't parse
    const tryParse = (s: string) => {
      const r = schema.safeParse(JSON.parse(s));
      return r.success ? r.data : null;
    };

    const direct = tryParse(candidate);
    if (direct) return direct;

    // Extract first JSON object or array from anywhere in the text
    const objMatch = candidate.match(/(\{[\s\S]*\})/);
    if (objMatch?.[1]) {
      const r = tryParse(objMatch[1]);
      if (r) return r;
    }
    return null;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// System prompts
// --------------------------------------------------------------------------

const INTAKE_SYSTEM = `You are ContractGen, an AI assistant helping Softway Solutions build contracts efficiently.
Your job is to collect required contract fields through fast, natural conversation — like a smart colleague, not a form.

Supported contract types: msa, msa-sow, sow-standalone, change-order.
- msa: Standalone Master Services Agreement (no SOW attached)
- msa-sow: Full MSA + Statement of Work for a new client
- sow-standalone: Standalone SOW for a repeat client with an existing MSA
- change-order: Scope or pricing update to an existing SOW
Do NOT offer or accept nda or employment-contract — those are not supported.

Required fields for ALL types:
- contract_type: One of [msa, msa-sow, sow-standalone, change-order]
- client_legal_name: Full legal name of the client company
- client_office_address: Client's registered office address
- softway_rep: Softway account representative name
- project_fee_usd: Total project fee in USD (numbers only, no $ sign, no commas)
- completion_date: Project completion date (YYYY-MM-DD format)
- service_type: Description of services being provided

Additional required fields for msa and msa-sow:
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

Optional fields (capture if volunteered — never ask for these explicitly):
- payment_structure, location, travel_required, travel_cap, workshop_count,
  attendee_count, facilitator_count, duration_hrs, signature_date

Conversation strategy — move fast:
1. Ask for 2–4 related fields per message, grouped by theme. Natural groupings:
   - Client identity: client_legal_name + client_office_address (ask together)
   - Engagement: service_type + project_fee_usd + completion_date (ask together)
   - Signing: client_contact_name + client_contact_email + client_signatory_name + client_signatory_title (ask together)
2. When the user provides a block of text or data, extract EVERY field it contains in one pass — do not ask for fields that were just provided.
3. After any import (HubSpot, Drive, pasted text), acknowledge what was captured and attempt to deduce the contract_type from the context (e.g., if there's a new client, it's likely msa-sow). Ask ONLY for what is strictly still missing. Do NOT make conversational small talk.
4. Use [CHIPS: option1 | option2 | option3] at the end of a message whenever the answer is one of a known short list. Specific rules:
   - If asking for contract_type: [CHIPS: New client — MSA + SOW | Repeat client — SOW only | MSA only | Change Order]
   - If asking for service_type: [CHIPS: Culture & Change | Leadership Development | Digital Transformation | Strategy Consulting | Custom (describe below)]
   - If asking about travel: [CHIPS: Yes — travel required | No — remote only]
   - If asking about payment_structure: [CHIPS: 50% upfront / 50% on delivery | Milestone-based | Net-30 | Monthly retainer]
   - Do NOT emit CHIPS for free-text fields: names, addresses, fees, dates, emails, descriptions.
5. The moment all required fields for the contract type are present, immediately set ready=true and say "All set — ready to generate your contract!" Do NOT do a summary or ask for confirmation.
6. If the user gives partial info in a message, extract what's there and ask for the rest of that group in the same reply.

Output — always respond in JSON only:
{ "reply": "...", "fields": { "field_name": "value" }, "ready": false }
- Only include fields in "fields" that were newly captured in this turn
- All dates must be YYYY-MM-DD format
- project_fee_usd and original_fee_usd: numbers only, no $ or commas`;

const REVIEW_SYSTEM = `You are ContractGen's contract assistant. You help users review and edit their contract.
The contract's current field values are provided as key: value pairs.

For field edit commands (change fee, update timeline, extend deadline, modify name, etc.):
- Identify which field the user wants to change and the new value
- Reply: { "reply": "Done — updated the fee to $120,000.", "patch": { "field": "project_fee_usd", "newValue": "120000" }, "edited": true }

For ADD CLAUSE commands ("add a force majeure clause", "add a GDPR clause", "include a data processing section", etc.):
- Write the full professional clause text for the named clause in Softway's voice
- Reply: { "reply": "Added the Force Majeure clause to your contract.", "clauseAction": { "type": "add", "name": "Force Majeure", "body": "Full clause text here..." }, "edited": true }

For REMOVE CLAUSE commands ("remove the non-solicitation clause", "take out the travel clause", "delete the IP section", etc.):
- Identify the clause name to remove
- Reply: { "reply": "Removed the Non-Solicitation clause.", "clauseAction": { "type": "remove", "name": "Non-Solicitation" }, "edited": true }

For questions about the contract:
- Reply: { "reply": "...", "edited": false }

Known field keys: client_legal_name, client_office_address, project_fee_usd, completion_date,
service_type, softway_rep, client_contact_name, client_contact_email, effective_date,
payment_structure, location, travel_required, travel_cap, sow_number, signature_date,
change_description, original_fee_usd, client_signatory_name, client_signatory_title

Rules:
- project_fee_usd and original_fee_usd: numbers only, no $ or commas
- dates: YYYY-MM-DD format
- Clause body text must be complete, professional legal language — not a placeholder
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
  capturedFields?: Record<string, string>,
): Promise<{ reply: string; fields: Record<string, string>; ready: boolean }> {
  try {
    // Prepend confirmed fields as context so the AI never re-asks them
    const prefixMessages: Anthropic.MessageParam[] = [];
    if (capturedFields && Object.keys(capturedFields).length > 0) {
      const fieldList = Object.entries(capturedFields)
        .map(([k, v]) => `${k}="${v}"`)
        .join(', ');
      prefixMessages.push(
        { role: 'user', content: `[ALREADY CONFIRMED — DO NOT ASK AGAIN]: ${fieldList}. Skip these fields completely and ask only for the remaining required fields.` },
        { role: 'assistant', content: `Understood. I have noted the confirmed fields and will not ask about them again.` },
      );
    }

    const messages: Anthropic.MessageParam[] = [
      ...prefixMessages,
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
): Promise<{ reply: string; patch?: { field: string; newValue: string }; clauseAction?: { type: 'add'; name: string; body: string } | { type: 'remove'; name: string }; edited: boolean }> {
  try {
    const fieldContext = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
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
    if (parsed) return { reply: parsed.reply, patch: parsed.patch, clauseAction: parsed.clauseAction, edited: parsed.edited ?? false };
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

export async function extractFieldsFromText(
  text: string,
): Promise<Record<string, string>> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: cachedSystem(INTAKE_SYSTEM),
      messages: [
        {
          role: 'user',
          content: `Extract all available contract fields from the following document text. Return as many fields as you can find. Set ready=false.\n\n${text.slice(0, 6000)}`,
        },
      ],
    });
    const text2 = extractText(response);
    const parsed = parseJson(text2, IntakeOutputSchema);
    return parsed?.fields ?? {};
  } catch (err) {
    handleAnthropicError(err);
  }
}

export async function analyzeRedlines(docText: string): Promise<RedlineClause[]> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: REDLINE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Analyse this redlined contract and identify every modified clause:\n\n${docText.slice(0, 12000)}`,
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

export async function uploadChat(
  journey: 'j3a' | 'j3b',
  context: object,
  question: string,
): Promise<{ reply: string }> {
  const systemText = journey === 'j3a'
    ? `You are a contract attorney helping resolve client redlines on a Softway Solutions contract. Answer questions about the flagged clauses concisely and in plain English.`
    : `You are a contract attorney helping Softway Solutions navigate a client's MSA. Answer questions about the identified risk flags concisely and in plain English.`;

  const contextText = JSON.stringify(context, null, 2);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemText,
      messages: [
        { role: 'user', content: `Document analysis context:\n${contextText}\n\nQuestion: ${question}` },
      ],
    });
    const text = extractText(response);
    return { reply: text };
  } catch (err) {
    handleAnthropicError(err);
  }
}

export async function analyzeClientMSA(
  docText: string,
): Promise<{ risks: RiskFlag[]; sowDraft: string }> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: CLIENT_MSA_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Client MSA to analyse:\n\n${docText.slice(0, 12000)}`,
        },
      ],
    });

    const text = extractText(response);
    const parsed = parseJson(text, MSAOutputSchema);
    if (parsed) return parsed;
    return { risks: [], sowDraft: '' };
  } catch (err) {
    handleAnthropicError(err);
  }
}
