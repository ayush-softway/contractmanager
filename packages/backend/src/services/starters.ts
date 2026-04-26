// Starter templates bundled with the app.
//
// These are pre-built Word documents (`packages/backend/starter-templates/`)
// generalized from real contracts. When a user imports one we upload the
// .docx to their Drive with Drive's native conversion to Google Doc — that
// preserves headings, lists, tables, bold, and any embedded images. The
// resulting Doc already contains `{{variable}}` placeholders so the user
// can immediately generate a contract.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import type { Template } from '@cg/shared';
import { db } from '../db/client.js';
import { createTemplateFromDocx, deleteFile } from '../google/drive.js';
import { getTemplate, syncTemplateVariables } from './templates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// services/starters.ts is in src/services/, so up two levels to packages/backend/.
const STARTER_DIR = resolve(__dirname, '../../starter-templates');

export interface Starter {
  /** Stable slug used in URLs. */
  slug: string;
  name: string;
  description: string;
  /** File on disk relative to STARTER_DIR. */
  filename: string;
}

export const STARTERS: Starter[] = [
  {
    slug: 'msa-sow',
    name: 'MSA + SOW (Merged)',
    description: 'A combined Master Services Agreement and Statement of Work for a new client engagement.',
    filename: 'msa-sow.docx',
  },
  {
    slug: 'sow-standalone',
    name: 'Standalone SOW',
    description: 'A Statement of Work governed by an existing MSA.',
    filename: 'sow-standalone.docx',
  },
  {
    slug: 'change-order',
    name: 'Change Order',
    description: 'An amendment to an existing SOW modifying scope, timeline, or fees.',
    filename: 'change-order.docx',
  },
  {
    slug: 'softway-msa',
    name: 'Softway MSA (New)',
    description: 'The newly imported Softway Master Services Agreement template.',
    filename: 'Softway_MSA_Template.docx',
  },
];

export function getStarter(slug: string): Starter | undefined {
  return STARTERS.find((s) => s.slug === slug);
}

/**
 * Import a starter into the user's workspace:
 *   1. Read the bundled .docx off disk
 *   2. Upload to Drive as a converted Google Doc
 *   3. Register a templates row pointing at the new Doc
 *   4. Sync variables (the .docx already has {{vars}} in it)
 */
export async function importStarter(
  userId: string,
  slug: string,
): Promise<{ template: Template; detectedVariables: string[] }> {
  const starter = getStarter(slug);
  if (!starter) throw new Error(`Unknown starter: ${slug}`);

  const filePath = resolve(STARTER_DIR, starter.filename);
  const buffer = readFileSync(filePath);

  // 1. Create the Google Doc (Drive converts .docx -> Doc, formatting intact).
  const { driveFileId } = await createTemplateFromDocx(
    userId,
    starter.name,
    buffer,
  );

  // 2. Register in DB.
  const id = nanoid();
  try {
    db.prepare(
      `INSERT INTO templates (id, name, description, drive_file_id, owner_id)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, starter.name, starter.description, driveFileId, userId);
  } catch (err) {
    // Roll back the Drive file if the DB insert fails.
    try { await deleteFile(userId, driveFileId); } catch { /* best effort */ }
    throw err;
  }

  // 3. Sync variables from the Doc we just created.
  const synced = await syncTemplateVariables(userId, id);
  const fresh = getTemplate(userId, id);
  return {
    template: fresh ?? synced,
    detectedVariables: (fresh ?? synced).variables.map((v) => v.name),
  };
}
