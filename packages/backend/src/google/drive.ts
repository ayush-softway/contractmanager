import { Readable } from 'node:stream';
import { driveFor } from './clients.js';

const DOC_MIME = 'application/vnd.google-apps.document';
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

const TEMPLATES_FOLDER_NAME = 'Contract Generator · Templates';
const CONTRACTS_FOLDER_NAME = 'Contract Generator · Contracts';

/**
 * Find or create a folder by name in the user's Drive root.
 * Memoize per user in production; here we just query every call.
 */
async function ensureFolder(userId: string, folderName: string): Promise<string> {
  const drive = driveFor(userId);
  const existing = await drive.files.list({
    q: `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
  });
  const match = existing.data.files?.[0];
  if (match?.id) return match.id;

  const created = await drive.files.create({
    requestBody: { name: folderName, mimeType: FOLDER_MIME },
    fields: 'id',
  });
  if (!created.data.id) throw new Error('Drive folder creation returned no id');
  return created.data.id;
}

export async function ensureTemplatesFolder(userId: string): Promise<string> {
  return ensureFolder(userId, TEMPLATES_FOLDER_NAME);
}

export async function ensureContractsFolder(userId: string): Promise<string> {
  return ensureFolder(userId, CONTRACTS_FOLDER_NAME);
}

/** Create a blank Google Doc inside the user's templates folder. */
export async function createBlankTemplate(
  userId: string,
  name: string,
): Promise<{ driveFileId: string }> {
  const drive = driveFor(userId);
  const parentId = await ensureTemplatesFolder(userId);
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: DOC_MIME,
      parents: [parentId],
    },
    fields: 'id',
  });
  if (!res.data.id) throw new Error('Drive doc creation returned no id');
  return { driveFileId: res.data.id };
}

/**
 * Upload a DOCX buffer into the user's templates folder and have Drive
 * convert it into a Google Doc. This is the key to preserving formatting
 * (headings, bullets, bold, tables, images) when seeding templates —
 * Drive's native conversion is much higher fidelity than inserting plain
 * text into a blank Doc.
 */
export async function createTemplateFromDocx(
  userId: string,
  name: string,
  docxBuffer: Buffer,
): Promise<{ driveFileId: string }> {
  const drive = driveFor(userId);
  const parentId = await ensureTemplatesFolder(userId);
  const res = await drive.files.create({
    requestBody: {
      name,
      // Destination mime: Drive converts the upload to a Google Doc.
      mimeType: DOC_MIME,
      parents: [parentId],
    },
    media: {
      mimeType: DOCX_MIME,
      body: Readable.from(docxBuffer),
    },
    fields: 'id',
  });
  if (!res.data.id) throw new Error('Drive doc conversion returned no id');
  return { driveFileId: res.data.id };
}

/** Copy a template doc into the contracts folder, returning the new file id. */
export async function copyTemplateToContract(
  userId: string,
  templateFileId: string,
  newName: string,
): Promise<{ driveFileId: string }> {
  const drive = driveFor(userId);
  const parentId = await ensureContractsFolder(userId);
  const res = await drive.files.copy({
    fileId: templateFileId,
    requestBody: {
      name: newName,
      parents: [parentId],
    },
    fields: 'id',
  });
  if (!res.data.id) throw new Error('Drive copy returned no id');
  return { driveFileId: res.data.id };
}

export async function deleteFile(userId: string, fileId: string): Promise<void> {
  const drive = driveFor(userId);
  await drive.files.delete({ fileId });
}

export async function getFileName(userId: string, fileId: string): Promise<string | null> {
  const drive = driveFor(userId);
  const res = await drive.files.get({ fileId, fields: 'name' });
  return res.data.name ?? null;
}
