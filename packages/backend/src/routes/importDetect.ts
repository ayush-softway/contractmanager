// Softway ContractGen V2 — Import Detect Route
//
// POST /import/detect — unified source detection endpoint

import { Router } from 'express';
import { detectAndImport } from '../services/importDetect.js';

export const importDetectRouter: Router = Router();

// No auth required — this is a stateless text-processing endpoint
importDetectRouter.post('/', async (req, res, next) => {
  try {
    const { input } = req.body;
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'invalid_input', message: 'Provide an "input" string.' });
    }

    const result = await detectAndImport(input);
    return res.json(result);
  } catch (err) {
    // Graceful error for unrecognized input
    if (err instanceof Error && err.message.includes('Could not extract')) {
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
