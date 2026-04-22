import { nanoid } from 'nanoid';
import type { Contract, ContractStatus, GenerateContractInput } from '@cg/shared';
import { db } from '../db/client.js';
import { copyTemplateToContract } from '../google/drive.js';
import { replaceVariables } from '../google/docs.js';
import { getTemplate } from './templates.js';
import { deleteContractDraft, getContractDraft } from './contractDrafts.js';

interface ContractRow {
  id: string;
  template_id: string;
  title: string;
  drive_file_id: string;
  status: ContractStatus;
  variable_values_json: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function rowToContract(r: ContractRow): Contract {
  return {
    id: r.id,
    templateId: r.template_id,
    title: r.title,
    driveFileId: r.drive_file_id,
    status: r.status,
    variableValues: JSON.parse(r.variable_values_json) as Record<string, string>,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Generate a new contract from a template:
 * 1. Copy the template doc in Drive.
 * 2. Replace all `{{var}}` placeholders in one batch update.
 * 3. Write a row in `contracts`.
 */
export async function generateContract(
  userId: string,
  input: GenerateContractInput,
): Promise<Contract> {
  const template = getTemplate(userId, input.templateId);
  if (!template) throw new Error('Template not found');
  if (!template.driveFileId) {
    throw new Error(
      'This template does not have a Google Doc yet. Open it in Docs first, then generate.',
    );
  }

  const { driveFileId } = await copyTemplateToContract(
    userId,
    template.driveFileId,
    input.title,
  );

  try {
    await replaceVariables(userId, driveFileId, input.variableValues);
  } catch (err) {
    // If variable replacement fails, the copy is orphaned. In production
    // we'd enqueue a cleanup job; for now we log and let the user retry.
    console.error('Variable replacement failed; contract file may have stale placeholders', err);
    throw err;
  }

  const id = nanoid();
  db.prepare(
    `INSERT INTO contracts (id, template_id, title, drive_file_id, variable_values_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.templateId,
    input.title,
    driveFileId,
    JSON.stringify(input.variableValues),
    userId,
  );
  const row = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id) as ContractRow;
  return rowToContract(row);
}

export function listContracts(userId: string): Contract[] {
  const rows = db
    .prepare('SELECT * FROM contracts WHERE created_by = ? ORDER BY updated_at DESC')
    .all(userId) as ContractRow[];
  return rows.map(rowToContract);
}

export function getContract(userId: string, id: string): Contract | null {
  const row = db
    .prepare('SELECT * FROM contracts WHERE id = ? AND created_by = ?')
    .get(id, userId) as ContractRow | undefined;
  return row ? rowToContract(row) : null;
}

/**
 * Turn a draft into a real contract: runs the usual generation flow, then
 * removes the draft row. If generation fails the draft is preserved so the
 * user can retry.
 */
export async function finalizeContractDraft(userId: string, draftId: string): Promise<Contract> {
  const draft = getContractDraft(userId, draftId);
  if (!draft) throw new Error('Draft not found');
  const contract = await generateContract(userId, {
    templateId: draft.templateId,
    title: draft.title,
    variableValues: draft.variableValues,
  });
  deleteContractDraft(userId, draftId);
  return contract;
}

export function updateContractStatus(
  userId: string,
  id: string,
  status: ContractStatus,
): Contract | null {
  db.prepare(
    `UPDATE contracts SET status = ?, updated_at = datetime('now')
     WHERE id = ? AND created_by = ?`,
  ).run(status, id, userId);
  return getContract(userId, id);
}
