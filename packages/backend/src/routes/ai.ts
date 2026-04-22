import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/session.js';
import { runAIEdit } from '../services/ai.js';

export const aiRouter: Router = Router();

const EditBody = z.object({
  contractId: z.string().optional(),
  driveFileId: z.string().min(1),
  instruction: z.string().min(1).max(2000),
  range: z
    .object({
      startIndex: z.number().int().min(0),
      endIndex: z.number().int().min(0),
    })
    .optional(),
});

aiRouter.post('/edit', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    const body = EditBody.parse(req.body);
    const result = await runAIEdit(userId, body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
