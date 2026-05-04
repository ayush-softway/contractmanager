import { Router } from 'express';
import { z } from 'zod';
import { analyzeRedlines, analyzeClientMSA } from '../services/ai.js';
import type { UploadAnalysis } from '@cg/shared';

export const uploadRouter = Router();

const AnalyzeSchema = z.object({
  text: z.string().min(1),
  driveFileId: z.string().optional(),
  // hint lets the frontend tell us which journey to use when unambiguous
  journey: z.enum(['j3a', 'j3b']).optional(),
});

// --------------------------------------------------------------------------
// POST /upload/analyze — classify document and run AI analysis
// --------------------------------------------------------------------------
uploadRouter.post('/analyze', async (req, res, next) => {
  try {
    const { text, driveFileId, journey } = AnalyzeSchema.parse(req.body);

    // Detect journey if not provided:
    // J3A = client returned Softway's own contract with tracked changes
    // J3B = client sent their own MSA
    const detectedJourney =
      journey ??
      (text.toLowerCase().includes('tracked changes') ||
      text.toLowerCase().includes('strikethrough') ||
      text.toLowerCase().includes('redline')
        ? 'j3a'
        : 'j3b');

    let analysis: UploadAnalysis;

    if (detectedJourney === 'j3a') {
      const clauses = await analyzeRedlines(text);
      analysis = { journey: 'j3a', clauses, driveFileId };
    } else {
      const { risks, sowDraft } = await analyzeClientMSA(text);
      analysis = { journey: 'j3b', risks, sowDraft, driveFileId };
    }

    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// POST /upload/j3a/resolve — log clause resolution (Accept/Reject/Counter)
// Stateless for prototype — client tracks resolution state
// --------------------------------------------------------------------------
const ResolveSchema = z.object({
  clauseId: z.string().min(1),
  action: z.enum(['accepted', 'rejected', 'countered']),
  counterText: z.string().optional(),
});

uploadRouter.post('/j3a/resolve', (req, res, next) => {
  try {
    ResolveSchema.parse(req.body);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
