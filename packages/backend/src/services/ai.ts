import { GoogleGenerativeAI } from '@google/generative-ai';
import { nanoid } from 'nanoid';
import type { AIEditRequest, AIEditResponse } from '@cg/shared';
import { config } from '../config.js';
import { db } from '../db/client.js';
import {
  extractPlainText,
  extractRangeText,
  getDoc,
  replaceRange,
} from '../google/docs.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

const SYSTEM_PROMPT = `You are a meticulous contract-drafting assistant.
You edit legal contract text according to the user's instruction.

Rules:
- Return ONLY the edited text that should replace the selection. No preamble, no explanation, no markdown fences.
- Preserve the overall structure and numbering unless the instruction explicitly asks to change it.
- Keep existing defined terms capitalized and consistent.
- If the instruction is impossible or unsafe, return the original text unchanged.
- Match the tone and formality of the surrounding text.`;

/**
 * Execute an AI edit:
 * 1. Read the doc (and optionally a specific range).
 * 2. Ask Gemini to produce replacement text.
 * 3. Write the result back via the Docs API.
 * 4. Log the edit in ai_edits for audit.
 */
export async function runAIEdit(
  userId: string,
  req: AIEditRequest,
): Promise<AIEditResponse> {
  const doc = await getDoc(userId, req.driveFileId);
  const fullText = extractPlainText(doc);
  const bodyEnd = doc.body?.content?.[doc.body.content.length - 1]?.endIndex ?? 1;

  const range = req.range ?? { startIndex: 1, endIndex: Math.max(1, bodyEnd - 1) };
  const beforeText = req.range
    ? extractRangeText(doc, range.startIndex, range.endIndex)
    : fullText;

  const userMessage = [
    `<instruction>${req.instruction}</instruction>`,
    '',
    '<document-context>',
    fullText.slice(0, 8000), // surrounding context, capped
    '</document-context>',
    '',
    '<text-to-edit>',
    beforeText,
    '</text-to-edit>',
    '',
    'Output the edited replacement for <text-to-edit> only.',
  ].join('\n');

  const model = genAI.getGenerativeModel({
    model: config.GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.3,
    },
  });

  const result = await model.generateContent(userMessage);
  const editedText = result.response.text().trim();

  // Gemini returns token usage on usageMetadata. Fall back to 0 if absent.
  const inputTokens = result.response.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = result.response.usageMetadata?.candidatesTokenCount ?? 0;

  // Write it back to the doc.
  await replaceRange(userId, req.driveFileId, range.startIndex, range.endIndex, editedText);

  // Log the edit.
  db.prepare(
    `INSERT INTO ai_edits (id, contract_id, drive_file_id, user_id, instruction, before_text, after_text, model, input_tokens, output_tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    nanoid(),
    req.contractId ?? null,
    req.driveFileId,
    userId,
    req.instruction,
    beforeText,
    editedText,
    config.GEMINI_MODEL,
    inputTokens,
    outputTokens,
  );

  return {
    editedText,
    appliedRange: {
      startIndex: range.startIndex,
      endIndex: range.startIndex + editedText.length,
    },
    usage: {
      inputTokens,
      outputTokens,
    },
  };
}

// --------------------------------------------------------------------------
// Contract → template generalization
// --------------------------------------------------------------------------

const TEMPLATE_SYSTEM_PROMPT = `You convert a specific, signed or draft contract into a reusable TEMPLATE.

Your job is to identify every value that is specific to THIS deal — names, addresses, dates, dollar amounts, numbered counts, project-specific scope items, signatory info — and replace each one with a \`{{snake_case}}\` placeholder. Clauses that would be the same across every deal of this type (boilerplate: confidentiality, force majeure, limitation of liability, warranty disclaimers, governing law structure, etc.) stay as prose, but any jurisdiction, dollar cap, or numeric term inside them becomes a variable.

Rules:
- Output ONLY the templated contract text. No preamble, no markdown fences, no commentary.
- Preserve the document's original structure, headings, section numbering, and paragraph order.
- Use \`{{snake_case_names}}\` for placeholders. Reuse the same variable name when the same value appears multiple times (e.g. \`{{client_legal_name}}\` in both the parties block and the signatory page).
- Prefer descriptive names: \`{{effective_date}}\`, \`{{client_legal_name}}\`, \`{{governing_law_state}}\`, \`{{project_fee_usd}}\`, \`{{invoice_1_amount}}\`, \`{{payment_net_days}}\`.
- Preserve dollar signs and units outside the placeholder: \`$\{{project_fee_usd}}\`, \`Net \{{payment_net_days}}\`.
- Strip signatures, stamps, DocuSign envelope IDs, page numbers/footers, and scanned-PDF artifacts.
- Keep clause section numbering consistent with the original.
- When the original lists multiple similar items (deliverables, invoices, line items), convert them into a parameterized list with placeholders like \`{{deliverable_1}}\`, \`{{deliverable_2}}\`, etc. rather than dropping them.`;

export interface GeneralizeResult {
  templatedText: string;
  detectedVariables: string[];
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Turn a contract's plain text into a reusable template body. Returns the
 * rewritten text plus the list of `{{variables}}` the AI introduced (useful
 * for surfacing to the user).
 */
export async function generalizeContractToTemplate(
  sourceText: string,
): Promise<GeneralizeResult> {
  // Large contracts can exceed Gemini's context; cap at ~80k chars which
  // covers the vast majority of real SOWs/MSAs and leaves room for output.
  const trimmed = sourceText.length > 80_000
    ? sourceText.slice(0, 80_000) + '\n\n[…truncated…]'
    : sourceText;

  const userMessage = [
    '<source-contract>',
    trimmed,
    '</source-contract>',
    '',
    'Rewrite the source contract above as a reusable template per the rules. Output only the templated text.',
  ].join('\n');

  const model = genAI.getGenerativeModel({
    model: config.GEMINI_MODEL,
    systemInstruction: TEMPLATE_SYSTEM_PROMPT,
    generationConfig: {
      // Templates can be long — give ourselves headroom.
      maxOutputTokens: 16_384,
      temperature: 0.2,
    },
  });

  const result = await model.generateContent(userMessage);
  let templatedText = result.response.text().trim();

  // Defensive: strip leading markdown code fence if Gemini adds one despite
  // the system prompt telling it not to.
  templatedText = templatedText.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');

  const inputTokens = result.response.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = result.response.usageMetadata?.candidatesTokenCount ?? 0;

  const detectedVariables = Array.from(
    new Set(
      Array.from(templatedText.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g))
        .map((m) => m[1])
        .filter((n): n is string => !!n),
    ),
  );

  return {
    templatedText,
    detectedVariables,
    usage: { inputTokens, outputTokens },
  };
}
