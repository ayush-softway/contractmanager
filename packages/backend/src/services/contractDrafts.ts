import { nanoid } from 'nanoid';
import type {
  ContractDraft,
  CreateContractDraftInput,
  UpdateContractDraftInput,
} from '@cg/shared';
import { db } from '../db/client.js';
import { getTemplate } from './templates.js';

/**
 * Contract drafts let users fill in a template's variables over multiple
 * sessions before committing to a generated Drive document. Creating the
 * actual contract happens via `finalizeDraft` which delegates to
 * `generateContract` and then removes the draft row.
 */

interface DraftRow {
  id: string;
  template_id: string;
  title: string;
  variable_values_json: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function rowToDraft(r: DraftRow): ContractDraft {
  return {
    id: r.id,
    templateId: r.template_id,
    title: r.title,
    variableValues: JSON.parse(r.variable_values_json) as Record<string, string>,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listContractDrafts(userId: string): ContractDraft[] {
  const rows = db
    .prepare('SELECT * FROM contract_drafts WHERE created_by = ? ORDER BY updated_at DESC')
    .all(userId) as DraftRow[];
  return rows.map(rowToDraft);
}

export function getContractDraft(userId: string, id: string): ContractDraft | null {
  const row = db
    .prepare('SELECT * FROM contract_drafts WHERE id = ? AND created_by = ?')
    .get(id, userId) as DraftRow | undefined;
  return row ? rowToDraft(row) : null;
}

export function createContractDraft(
  userId: string,
  input: CreateContractDraftInput,
): ContractDraft {
  // Confirm the template exists and belongs to this user before inserting;
  // the FK would reject orphan rows anyway but this yields a nicer error.
  const tmpl = getTemplate(userId, input.templateId);
  if (!tmpl) throw new Error('Template not found');

  const id = nanoid();
  db.prepare(
    `INSERT INTO contract_drafts (id, template_id, title, variable_values_json, created_by)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.templateId,
    input.title,
    JSON.stringify(input.variableValues ?? {}),
    userId,
  );
  const draft = getContractDraft(userId, id);
  if (!draft) throw new Error('Failed to create draft');
  return draft;
}

export function updateContractDraft(
  userId: string,
  id: string,
  patch: UpdateContractDraftInput,
): ContractDraft {
  const existing = getContractDraft(userId, id);
  if (!existing) throw new Error('Draft not found');

  const nextTitle = patch.title ?? existing.title;
  const nextValues =
    patch.variableValues !== undefined ? patch.variableValues : existing.variableValues;

  db.prepare(
    `UPDATE contract_drafts
       SET title = ?, variable_values_json = ?, updated_at = datetime('now')
     WHERE id = ? AND created_by = ?`,
  ).run(nextTitle, JSON.stringify(nextValues), id, userId);

  const updated = getContractDraft(userId, id);
  if (!updated) throw new Error('Draft not found after update');
  return updated;
}

export function deleteContractDraft(userId: string, id: string): void {
  db.prepare('DELETE FROM contract_drafts WHERE id = ? AND created_by = ?').run(id, userId);
}
