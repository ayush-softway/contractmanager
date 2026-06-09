import type { ImportResult } from '@cg/shared';
import { importFromHubSpot } from './hubspot.js';
import { extractDriveFields } from './driveImport.js';
import { extractFieldsFromText } from './ai.js';
import { driveFor } from '../google/clients.js';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function detectAndImport(input: string, userId?: string): Promise<ImportResult> {
  // HubSpot deal URL
  if (input.includes('app.hubspot.com')) {
    const dealId = input.match(/deal\/([a-zA-Z0-9-]+)/)?.[1]
      ?? input.match(/deals\/(\d+)/)?.[1]
      ?? input.match(/\/record\/0-3\/(\d+)/)?.[1];
    if (!dealId) throw new Error('Could not extract HubSpot deal ID from URL');
    return importFromHubSpot(dealId);
  }

  // Google Drive doc URL — fetch real content if authenticated
  if (input.includes('docs.google.com')) {
    const docId = input.match(/\/d\/([\w-]+)/)?.[1];
    if (!docId) throw new Error('Could not extract Google Doc ID from URL');
    return importFromDriveFile(docId, userId);
  }

  // Raw pasted text — use AI to extract fields
  const fields = await extractFieldsFromText(input);
  const hasFields = Object.keys(fields).length > 0;
  return {
    fields,
    source: 'text',
    label: hasFields ? 'Pasted Text' : 'No fields detected',
  };
}

export async function importFromFile(buffer: Buffer, mimetype: string, filename: string): Promise<ImportResult> {
  let text = '';
  const lower = (filename ?? '').toLowerCase();

  if (mimetype === 'application/pdf' || lower.endsWith('.pdf')) {
    const parsed = await pdfParse(buffer);
    text = parsed.text;
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword' ||
    lower.endsWith('.docx') ||
    lower.endsWith('.doc')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (mimetype === 'text/html' || lower.endsWith('.html') || lower.endsWith('.htm')) {
    text = buffer.toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } else {
    text = buffer.toString('utf-8');
  }

  if (!text.trim()) {
    return { fields: {}, source: 'file', label: filename };
  }

  const fields = await extractFieldsFromText(text.slice(0, 8000));
  return { fields, source: 'file', label: filename };
}

export async function importFromDriveFile(fileId: string, userId?: string): Promise<ImportResult> {
  if (!userId || userId === 'demo-user') {
    return { fields: {}, source: 'drive', label: 'Sign in to import from Drive' };
  }

  try {
    const drive = driveFor(userId);
    const res = await drive.files.export({ fileId, mimeType: 'text/plain' });
    const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const fields = await extractFieldsFromText(text);
    const meta = await drive.files.get({ fileId, fields: 'name' });
    const label = (meta.data as any).name ?? 'Google Drive Doc';
    return { fields, source: 'drive', label };
  } catch (err: any) {
    throw new Error(`Could not read Drive doc: ${err.message}`);
  }
}
