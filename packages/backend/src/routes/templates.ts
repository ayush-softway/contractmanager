import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../auth/session.js';
import { extractPlainText, getDoc } from '../google/docs.js';
import {
  createTemplate,
  createTemplateFromUpload,
  deleteTemplate,
  getTemplate,
  listTemplates,
  syncTemplateVariables,
  updateTemplateSections,
} from '../services/templates.js';
import { isSupportedMime, SUPPORTED_MIMES } from '../services/extract.js';
import { importStarter, STARTERS } from '../services/starters.js';

export const templatesRouter: Router = Router();

// In-memory uploads; contracts are rarely more than a few MB and we don't
// need them persisted once the template is written to Drive.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

const VariableSchema = z.object({
  name: z.string().min(1),
  label: z.string().optional(),
  defaultValue: z.string().optional(),
  type: z.enum(['text', 'date', 'number', 'email']).optional(),
  required: z.boolean().optional(),
});

const SectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  required: z.boolean(),
  fields: z.array(VariableSchema),
});

const UpdateSectionsBody = z.object({
  sections: z.array(SectionSchema),
});

templatesRouter.get('/', requireAuth, (req, res) => {
  const userId = (req as unknown as { userId: string }).userId;
  res.json({ templates: listTemplates(userId) });
});

// --------------------------------------------------------------------------
// Starter templates (bundled with the app — MSA, SOW)
// --------------------------------------------------------------------------

/** GET /templates/starters — list available starters (no auth needed; static catalog). */
templatesRouter.get('/starters', (_req, res) => {
  res.json({
    starters: STARTERS.map((s) => ({
      slug: s.slug,
      name: s.name,
      description: s.description,
    })),
  });
});

/**
 * POST /templates/starters/:slug/import
 * Imports the bundled .docx into the user's Drive as a Google Doc and
 * registers it as a template. Returns the new Template plus the variables
 * detected from the doc body.
 */
templatesRouter.post('/starters/:slug/import', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    const slug = String(req.params.slug);
    const result = await importStarter(userId, slug);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

templatesRouter.post('/', requireAuth, (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    const body = CreateBody.parse(req.body);
    const template = createTemplate(userId, body);
    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
});

templatesRouter.get('/:id', requireAuth, (req, res) => {
  const userId = (req as unknown as { userId: string }).userId;
  const template = getTemplate(userId, String(req.params.id));
  if (!template) return res.status(404).json({ error: 'not_found' });
  res.json({ template });
});

templatesRouter.patch('/:id/sections', requireAuth, (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    const { sections } = UpdateSectionsBody.parse(req.body);
    const template = updateTemplateSections(userId, String(req.params.id), sections);
    res.json({ template });
  } catch (err) {
    next(err);
  }
});

templatesRouter.post('/:id/sync', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    const template = await syncTemplateVariables(userId, String(req.params.id));
    res.json({ template });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// POST /templates/from-upload
//
// Two flavours, distinguished by Content-Type:
//   - multipart/form-data: a binary file upload (PDF or DOCX) as `file`,
//     with optional `name` and `description` text fields.
//   - application/json:    { "sourceType": "google-doc", "fileId": "...",
//                            "name"?: string, "description"?: string }
//
// In both cases we extract text → AI generalize → create a new Google Doc →
// register a templates row and return it.
// --------------------------------------------------------------------------

const FromGoogleDocBody = z.object({
  sourceType: z.literal('google-doc'),
  fileId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

templatesRouter.post(
  '/from-upload',
  requireAuth,
  upload.single('file'),
  async (req, res, next) => {
    try {
      const userId = (req as unknown as { userId: string }).userId;

      // JSON path: a Google Doc the user already owns/opened with our app.
      if (!req.file && req.is('application/json')) {
        const body = FromGoogleDocBody.parse(req.body);
        const doc = await getDoc(userId, body.fileId);
        const sourceText = extractPlainText(doc);
        const result = await createTemplateFromUpload({
          userId,
          sourceText,
          name: body.name,
          description: body.description,
        });
        return res.status(201).json(result);
      }

      // Multipart path: a PDF/DOCX upload.
      if (!req.file) {
        return res.status(400).json({
          error: 'no_source',
          message: 'Provide either a `file` upload or a JSON body with `sourceType: "google-doc"`.',
        });
      }
      if (!isSupportedMime(req.file.mimetype)) {
        return res.status(415).json({
          error: 'unsupported_media_type',
          message: `Unsupported file type ${req.file.mimetype}. Supported: ${SUPPORTED_MIMES.join(', ')}`,
        });
      }

      const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
      const description = typeof req.body?.description === 'string' ? req.body.description : undefined;

      const result = await createTemplateFromUpload({
        userId,
        file: {
          buffer: req.file.buffer,
          mimetype: req.file.mimetype,
          originalname: req.file.originalname,
        },
        name,
        description,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

templatesRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    await deleteTemplate(userId, String(req.params.id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
