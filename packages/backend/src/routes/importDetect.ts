import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth/session.js';
import { detectAndImport, importFromDriveFile, importFromFile } from '../services/importDetect.js';
import { searchHubSpotDeals } from '../services/hubspot.js';
import { driveFor } from '../google/clients.js';
import type { Request } from 'express';

export const importDetectRouter: Router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /import/detect — unified source detection (URL, fileId, or raw text)
importDetectRouter.post('/detect', async (req, res, next) => {
  try {
    const { input, fileId } = req.body;
    const userId = (req as any).userId as string | undefined;

    if (fileId) {
      const result = await importFromDriveFile(String(fileId), userId);
      return res.json(result);
    }

    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'invalid_input', message: 'Provide an "input" string or "fileId".' });
    }

    const result = await detectAndImport(input, userId);
    return res.json(result);
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Could not extract') || err.message.includes('Could not read'))) {
      return res.status(400).json({
        error: 'detection_failed',
        message: err.message,
        fields: {},
        source: 'text',
        label: 'Detection failed',
      });
    }
    next(err);
  }
});

// POST /import/file — extract fields from an uploaded PDF or DOCX
importDetectRouter.post('/file', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'no_file', message: 'Attach a file with field name "file".' });
    }
    const result = await importFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /import/extract-text — extract raw text from PDF/DOCX/HTML (no AI, no field extraction)
// Used by the upload modal to get document text before calling /upload/analyze
importDetectRouter.post('/extract-text', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'no_file', message: 'Attach a file with field name "file".' });
    }
    const { buffer, mimetype, originalname } = req.file;
    const lower = (originalname ?? '').toLowerCase();
    let text = '';

    if (mimetype === 'application/pdf' || lower.endsWith('.pdf')) {
      const { default: pdfParse } = await import('pdf-parse');
      const parsed = await pdfParse(buffer);
      text = parsed.text;
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword' ||
      lower.endsWith('.docx') || lower.endsWith('.doc')
    ) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      // HTML or plain text — preserve raw content including markup
      text = buffer.toString('utf-8');
    }

    res.json({ text });
  } catch (err) {
    next(err);
  }
});

// GET /import/hubspot/search?q= — search HubSpot deals by name
importDetectRouter.get('/hubspot/search', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.json({ deals: [] });
    const deals = await searchHubSpotDeals(q);
    res.json({ deals });
  } catch (err: any) {
    if (err.message?.includes('HUBSPOT_API_TOKEN not configured')) {
      return res.status(503).json({ error: 'hubspot_not_configured', message: 'HubSpot integration not configured.' });
    }
    next(err);
  }
});

// GET /import/drive/files — list recent Google Docs for the authenticated user
importDetectRouter.get('/drive/files', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const drive = driveFor(userId);
    const listRes = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.document' and trashed=false",
      fields: 'files(id,name,modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 20,
    });
    res.json({ files: listRes.data.files ?? [] });
  } catch (err) {
    next(err);
  }
});
