import type { docs_v1 } from 'googleapis';
import { docsFor } from './clients.js';

// --------------------------------------------------------------------------
// Reading a doc
// --------------------------------------------------------------------------

export async function getDoc(userId: string, documentId: string): Promise<docs_v1.Schema$Document> {
  const docs = docsFor(userId);
  const res = await docs.documents.get({ documentId });
  if (!res.data) throw new Error(`Empty response for document ${documentId}`);
  return res.data;
}

/**
 * Flatten a doc's body into a plain string. Useful for variable detection
 * and AI prompting. Discards all formatting — this is intentional, use the
 * structured response from getDoc if you need styles.
 */
export function extractPlainText(doc: docs_v1.Schema$Document): string {
  const body = doc.body?.content ?? [];
  const parts: string[] = [];
  for (const element of body) {
    const paragraph = element.paragraph;
    if (!paragraph) continue;
    for (const elt of paragraph.elements ?? []) {
      if (elt.textRun?.content) parts.push(elt.textRun.content);
    }
  }
  return parts.join('');
}

/**
 * Extract the text within a specific index range. Google Docs indices are
 * 1-based and include structural characters, so this is approximate — we
 * walk the doc and accumulate text whose absolute index falls in range.
 */
export function extractRangeText(
  doc: docs_v1.Schema$Document,
  startIndex: number,
  endIndex: number,
): string {
  const body = doc.body?.content ?? [];
  const parts: string[] = [];
  for (const element of body) {
    const paragraph = element.paragraph;
    if (!paragraph) continue;
    for (const elt of paragraph.elements ?? []) {
      const text = elt.textRun?.content;
      if (!text) continue;
      const eltStart = elt.startIndex ?? 0;
      const eltEnd = elt.endIndex ?? eltStart + text.length;
      if (eltEnd <= startIndex || eltStart >= endIndex) continue;
      // Trim to the requested window.
      const sliceStart = Math.max(0, startIndex - eltStart);
      const sliceEnd = text.length - Math.max(0, eltEnd - endIndex);
      parts.push(text.slice(sliceStart, sliceEnd));
    }
  }
  return parts.join('');
}

// --------------------------------------------------------------------------
// Variables
// --------------------------------------------------------------------------

const VARIABLE_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/** Return the unique variable names used in a template doc. */
export function detectVariables(plainText: string): string[] {
  const names = new Set<string>();
  for (const match of plainText.matchAll(VARIABLE_RE)) {
    if (match[1]) names.add(match[1]);
  }
  return Array.from(names);
}

// --------------------------------------------------------------------------
// Writing
// --------------------------------------------------------------------------

/**
 * Replace all `{{name}}` placeholders with the given values in a single
 * batchUpdate call. Skips undefined values — callers are expected to validate.
 */
export async function replaceVariables(
  userId: string,
  documentId: string,
  values: Record<string, string>,
): Promise<void> {
  const docs = docsFor(userId);
  const requests: docs_v1.Schema$Request[] = [];
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) continue;
    requests.push({
      replaceAllText: {
        containsText: { text: `{{${name}}}`, matchCase: true },
        replaceText: value,
      },
    });
  }
  if (requests.length === 0) return;
  await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
}

/**
 * Replace a specific range in the doc with new text. This is the building
 * block for AI edits: delete the old range, insert the new text at the
 * same start index.
 */
export async function replaceRange(
  userId: string,
  documentId: string,
  startIndex: number,
  endIndex: number,
  newText: string,
): Promise<void> {
  const docs = docsFor(userId);
  const requests: docs_v1.Schema$Request[] = [];
  if (endIndex > startIndex) {
    requests.push({
      deleteContentRange: {
        range: { startIndex, endIndex },
      },
    });
  }
  if (newText.length > 0) {
    requests.push({
      insertText: {
        location: { index: startIndex },
        text: newText,
      },
    });
  }
  if (requests.length === 0) return;
  await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
}

/** Append text at the end of the doc. Useful for adding new clauses. */
export async function appendText(
  userId: string,
  documentId: string,
  text: string,
): Promise<void> {
  const doc = await getDoc(userId, documentId);
  const body = doc.body?.content ?? [];
  const last = body[body.length - 1];
  // endIndex of the last element - 1 is the insertion point before the trailing newline.
  const insertAt = Math.max(1, (last?.endIndex ?? 2) - 1);
  await replaceRange(userId, documentId, insertAt, insertAt, text);
}

/**
 * Replace the entire body of a doc with the given plain text. Used by the
 * upload-to-template pipeline to seed a blank Google Doc with AI-generated
 * templated content.
 *
 * The Google Docs body always has an implicit trailing newline at index
 * `bodyEnd - 1`; we insert just before it to avoid the "index out of range"
 * error from the API.
 */
export async function setDocBody(
  userId: string,
  documentId: string,
  text: string,
): Promise<void> {
  const docs = docsFor(userId);
  const doc = await getDoc(userId, documentId);
  const body = doc.body?.content ?? [];
  const last = body[body.length - 1];
  const bodyEnd = Math.max(2, last?.endIndex ?? 2);

  const requests: docs_v1.Schema$Request[] = [];
  // Delete everything from index 1 to bodyEnd - 1 (leaving the trailing newline).
  if (bodyEnd > 2) {
    requests.push({
      deleteContentRange: { range: { startIndex: 1, endIndex: bodyEnd - 1 } },
    });
  }
  if (text.length > 0) {
    requests.push({ insertText: { location: { index: 1 }, text } });
  }
  if (requests.length === 0) return;
  await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
}
