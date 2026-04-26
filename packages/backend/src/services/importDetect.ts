// Softway ContractGen V2 — Unified Source Detection Service
//
// Single entry point for all data import: HubSpot URLs, Google Drive links,
// and raw pasted text (meeting notes, emails, etc.)

import type { ImportResult, ImportSource } from '@cg/shared';
import { importFromHubSpot } from './hubspot.js';
import { extractDriveFields } from './driveImport.js';

export async function detectAndImport(input: string): Promise<ImportResult> {
  // HubSpot deal URL
  if (input.includes('app.hubspot.com')) {
    const dealId = input.match(/deal\/([a-zA-Z0-9-]+)/)?.[1]
      ?? input.match(/deals\/(\d+)/)?.[1];
    if (!dealId) throw new Error('Could not extract HubSpot deal ID from URL');
    return importFromHubSpot(dealId);
  }

  // Google Drive doc URL
  if (input.includes('docs.google.com')) {
    const docId = input.match(/\/d\/([\w-]+)/)?.[1];
    if (!docId) throw new Error('Could not extract Google Doc ID from URL');
    // For V2 prototype: mock Drive content extraction
    // In production, we'd fetch the doc text via Docs API using the user's credentials
    const fields = extractDriveFields('MSA Effective Date: ' + new Date().toLocaleDateString());
    return { fields, source: 'drive', label: 'Google Drive Doc' };
  }

  // Raw pasted text
  const fields = extractDriveFields(input);
  const hasFields = Object.keys(fields).length > 0;
  return {
    fields,
    source: 'text',
    label: hasFields ? 'Pasted Text' : 'No fields detected',
  };
}
