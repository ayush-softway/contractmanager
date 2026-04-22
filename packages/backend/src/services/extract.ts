// Plain-text extraction for uploaded contract files.
//
// We deliberately discard formatting here — the AI generalization step
// only needs the raw text to identify what should become {{variables}}.
// Re-creating the Doc layout is the user's job inside Google Docs.

import mammoth from 'mammoth';
// pdf-parse exports a default function and is CommonJS; load it dynamically
// so its top-level test code (which reads ./test/data/) doesn't run when
// imported from our ESM build.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export type SupportedMime =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain'
  | 'text/markdown';

export const SUPPORTED_MIMES: SupportedMime[] = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];

export function isSupportedMime(mime: string): mime is SupportedMime {
  return (SUPPORTED_MIMES as string[]).includes(mime);
}

/**
 * Extract plain text from a file buffer. Throws if the mime type isn't
 * supported or extraction fails. Caller is expected to catch and convert to
 * a 4xx response.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mime: string,
): Promise<string> {
  if (mime === 'application/pdf') {
    const pdfParse = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    return normalize(result.text);
  }

  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return normalize(result.value);
  }

  if (mime === 'text/plain' || mime === 'text/markdown') {
    return normalize(buffer.toString('utf8'));
  }

  throw new Error(`Unsupported mime type: ${mime}`);
}

/**
 * Trim each line, collapse 3+ blank lines into 2. Keeps the text dense
 * enough to fit in the Gemini context window without losing paragraph
 * boundaries.
 */
function normalize(raw: string): string {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trimEnd());
  const out: string[] = [];
  let blankRun = 0;
  for (const line of lines) {
    if (line.trim() === '') {
      blankRun++;
      if (blankRun <= 1) out.push('');
    } else {
      blankRun = 0;
      out.push(line);
    }
  }
  return out.join('\n').trim();
}
