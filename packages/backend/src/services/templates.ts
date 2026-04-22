import { nanoid } from 'nanoid';
import type { Template, TemplateSection, TemplateVariable } from '@cg/shared';
import { db } from '../db/client.js';
import { createBlankTemplate, deleteFile } from '../google/drive.js';
import {
  detectVariables,
  extractPlainText,
  getDoc,
  setDocBody,
} from '../google/docs.js';
import { generalizeContractToTemplate } from './ai.js';
import { extractTextFromBuffer } from './extract.js';

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  drive_file_id: string;
  variables_json: string;
  sections_json: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

function rowToTemplate(r: TemplateRow): Template {
  const sections = JSON.parse(r.sections_json) as TemplateSection[];
  // Variable list used by the generate form. When the user has organized the
  // template into sections we derive from those (source of truth once edited).
  // Otherwise fall back to the flat `variables_json` — that's what
  // `syncTemplateVariables` writes when a freshly imported template has no
  // sections yet but already contains `{{…}}` placeholders in the Doc.
  const flatVars = JSON.parse(r.variables_json) as TemplateVariable[];
  const variables =
    sections.length > 0 ? sections.flatMap((s) => s.fields) : flatVars;
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    driveFileId: r.drive_file_id || undefined,
    sections,
    variables,
    ownerId: r.owner_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createTemplate(
  userId: string,
  input: { name: string; description?: string },
): Template {
  const id = nanoid();
  db.prepare(
    `INSERT INTO templates (id, name, description, drive_file_id, owner_id)
     VALUES (?, ?, ?, '', ?)`,
  ).run(id, input.name, input.description ?? null, userId);
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as TemplateRow;
  return rowToTemplate(row);
}

export function listTemplates(userId: string): Template[] {
  const rows = db
    .prepare('SELECT * FROM templates WHERE owner_id = ? ORDER BY updated_at DESC')
    .all(userId) as TemplateRow[];
  return rows.map(rowToTemplate);
}

export function getTemplate(userId: string, id: string): Template | null {
  const row = db
    .prepare('SELECT * FROM templates WHERE id = ? AND owner_id = ?')
    .get(id, userId) as TemplateRow | undefined;
  return row ? rowToTemplate(row) : null;
}

export function updateTemplateSections(
  userId: string,
  templateId: string,
  sections: TemplateSection[],
): Template {
  const template = getTemplate(userId, templateId);
  if (!template) throw new Error('Template not found');

  // Derive flat variables list from sections so the generate form stays in sync.
  const variables: TemplateVariable[] = sections.flatMap((s) => s.fields);

  db.prepare(
    `UPDATE templates
     SET sections_json = ?, variables_json = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(JSON.stringify(sections), JSON.stringify(variables), templateId);

  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as TemplateRow;
  return rowToTemplate(row);
}

/**
 * Re-scan the underlying Google Doc for `{{variable}}` placeholders and
 * update the stored variable list. Only valid if the template has a Drive file.
 */
export async function syncTemplateVariables(
  userId: string,
  templateId: string,
): Promise<Template> {
  const template = getTemplate(userId, templateId);
  if (!template) throw new Error('Template not found');
  if (!template.driveFileId) throw new Error('Template has no Google Doc yet');

  const doc = await getDoc(userId, template.driveFileId);
  const text = extractPlainText(doc);
  const names = detectVariables(text);

  const existingByName = new Map(template.variables.map((v) => [v.name, v]));
  const variables: TemplateVariable[] = names.map(
    (name) => existingByName.get(name) ?? { name, type: 'text', required: true },
  );

  db.prepare(
    `UPDATE templates SET variables_json = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(JSON.stringify(variables), templateId);

  return { ...template, variables, updatedAt: new Date().toISOString() };
}

// --------------------------------------------------------------------------
// Build a template from an uploaded contract
//
// 1. Extract plain text (PDF/DOCX/Google Doc) → see services/extract.ts
// 2. Ask Gemini to rewrite it as a template with {{variables}}
// 3. Create a blank Google Doc in the user's templates folder
// 4. Insert the AI text into the Doc (single batchUpdate)
// 5. Register a templates row, then sync variables from the Doc
// --------------------------------------------------------------------------

export interface CreateFromUploadInput {
  userId: string;
  /** Already-extracted text. Pass when source is a Google Doc the user owns. */
  sourceText?: string;
  /** File upload payload. Pass when source is a binary the user uploaded. */
  file?: { buffer: Buffer; mimetype: string; originalname: string };
  name?: string;
  description?: string;
}

export interface CreateFromUploadResult {
  template: Template;
  detectedVariables: string[];
}

export async function createTemplateFromUpload(
  input: CreateFromUploadInput,
): Promise<CreateFromUploadResult> {
  const { userId, file, name: providedName, description } = input;

  // 1. Get plain text.
  let sourceText = input.sourceText ?? '';
  if (!sourceText && file) {
    sourceText = await extractTextFromBuffer(file.buffer, file.mimetype);
  }
  if (!sourceText.trim()) {
    throw new Error('Could not extract any text from the source');
  }

  // 2. Generalize via AI.
  const { templatedText, detectedVariables } =
    await generalizeContractToTemplate(sourceText);

  // 3. Pick a friendly default name if the caller didn't supply one.
  const name = providedName?.trim() ||
    (file?.originalname
      ? file.originalname.replace(/\.[^.]+$/, '') + ' (Template)'
      : 'Imported Template');

  // 4. Create the blank Google Doc + register the row first, so if the Doc
  //    write fails we still have a record we can clean up.
  const id = nanoid();
  const { driveFileId } = await createBlankTemplate(userId, name);

  db.prepare(
    `INSERT INTO templates (id, name, description, drive_file_id, owner_id)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, name, description ?? null, driveFileId, userId);

  // 5. Push the templated text into the Doc.
  try {
    await setDocBody(userId, driveFileId, templatedText);
  } catch (err) {
    // Roll back: delete the orphaned Doc and our row.
    console.error('Failed to write templated text into Doc; rolling back', err);
    try { await deleteFile(userId, driveFileId); } catch { /* best effort */ }
    db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    throw err;
  }

  // 6. Sync the variable list from what we just wrote.
  const synced = await syncTemplateVariables(userId, id);
  return { template: synced, detectedVariables };
}

export async function deleteTemplate(userId: string, id: string): Promise<void> {
  const template = getTemplate(userId, id);
  if (!template) return;
  if (template.driveFileId) {
    try {
      await deleteFile(userId, template.driveFileId);
    } catch (err) {
      console.warn(`Failed to delete template Drive file ${template.driveFileId}:`, err);
    }
  }
  db.prepare('DELETE FROM templates WHERE id = ? AND owner_id = ?').run(id, userId);
}
