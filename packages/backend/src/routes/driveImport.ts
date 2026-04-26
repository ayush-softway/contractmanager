import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import { extractDriveFields } from '../services/driveImport.js';

export const driveImportRouter: Router = Router();

driveImportRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const fields = await extractDriveFields(req.body.text || '');
    res.json(fields);
  } catch (err) {
    next(err);
  }
});
