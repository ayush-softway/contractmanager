// Softway ContractGen V2 — Contracts Service
//
// Core generation flow: validate fields → copy locked template →
// fill variables → save contract record.

import crypto from 'node:crypto';
import fs from 'node:fs';
import { marked } from 'marked';
import { db } from '../db/client.js';
import { driveFor } from '../google/clients.js';
import { getStarter, getStarterDocxPath, getStarterMdPath, getRequiredFieldKeys } from './starters.js';
import { verifyClauseCoverage } from './ai.js';
import type { ContractType } from '@cg/shared';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export async function generateContractV2(
  userId: string,
  contractType: ContractType,
  fields: Record<string, string>,
): Promise<{ contractId: string; driveFileId: string; previewUrl: string }> {

  // 1. Validate — block if any required field is empty
  const required = getRequiredFieldKeys(contractType);
  const missing = required.filter(f => !fields[f]?.trim());
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }

  // 2. Get the correct locked template for this contract type
  const starter = getStarter(contractType);
  if (!starter) {
    throw new ValidationError(`Unknown contract type: ${contractType}`);
  }

  let driveFileId = 'demo-mock-id';
  let renderedHtml = '';

  // DEMO MODE: Skip actual Google Drive API calls if unauthenticated
  if (userId !== 'demo-user') {
    const drive = driveFor(userId);
    const templatePath = getStarterDocxPath(starter);

    const createRes = await drive.files.create({
      requestBody: {
        name: `${fields.client_legal_name ?? 'Client'} — ${starter.label}`,
        mimeType: 'application/vnd.google-apps.document',
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        body: fs.createReadStream(templatePath),
      },
      fields: 'id',
    });

    driveFileId = createRes.data.id!;

    // Replace {{variables}} in the Google Doc
    const { google } = await import('googleapis');
    const docs = google.docs({ version: 'v1', auth: drive.context._options.auth as any });

    const requests = Object.entries(fields)
      .filter(([_, value]) => value)
      .map(([key, value]) => ({
        replaceAllText: {
          containsText: { text: `{{${key}}}`, matchCase: false },
          replaceText: value,
        },
      }));

    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: driveFileId,
        requestBody: { requests },
      });
    }
  } else {
    // Demo mode: read .md, substitute variables, convert to HTML
    const mdPath = getStarterMdPath(starter);
    let markdown = fs.readFileSync(mdPath, 'utf-8');
    const fieldMap = new Map(Object.entries(fields).map(([k, v]) => [k.toLowerCase(), v]));
    markdown = markdown.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      fieldMap.get(key.toLowerCase()) ?? `[${key} not provided]`
    );
    renderedHtml = await marked.parse(markdown);
  }

  // Run clause coverage checks on the rendered HTML
  const clauses = db.prepare('SELECT * FROM clauses').all() as any[];
  const clauseChecks = renderedHtml
    ? await verifyClauseCoverage(renderedHtml, clauses)
    : {};

  // 3. Save contract record to DB
  const contractId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO contracts (id, user_id, title, contract_type, status, drive_file_id,
      field_values_json, rendered_html_snapshot, clause_checks_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'generated', ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    contractId,
    userId,
    `${fields.client_legal_name ?? 'Client'} — ${starter.label}`,
    contractType,
    driveFileId,
    JSON.stringify(fields),
    renderedHtml,
    JSON.stringify(clauseChecks),
  );

  return {
    contractId,
    driveFileId,
    previewUrl: `https://docs.google.com/document/d/${driveFileId}/preview`,
  };
}

export function getContract(contractId: string) {
  return db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId) as any | undefined;
}

export function listContracts(userId: string) {
  return db.prepare('SELECT * FROM contracts WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
}

export function updateContractStatus(contractId: string, status: string, extra: Record<string, string> = {}) {
  const sets = ['status = ?', 'updated_at = datetime(\'now\')'];
  const values: any[] = [status];
  for (const [key, value] of Object.entries(extra)) {
    sets.push(`${key} = ?`);
    values.push(value);
  }
  values.push(contractId);
  db.prepare(`UPDATE contracts SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}
