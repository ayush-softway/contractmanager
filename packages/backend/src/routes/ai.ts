import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/session.js';
import { getContract } from '../services/contracts.js';
import { intakeChat, reviewChat } from '../services/ai.js';
import { getDoc, extractPlainText, replaceVariables } from '../google/docs.js';

export const aiRouter = Router();

// --------------------------------------------------------------------------
// POST /ai/intake — conversational intake turn
// --------------------------------------------------------------------------
const IntakeSchema = z.object({
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
  message: z.string().min(1),
});

aiRouter.post('/intake', async (req, res, next) => {
  try {
    const { history, message } = IntakeSchema.parse(req.body);
    const result = await intakeChat(history, message);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// POST /ai/review-chat — edit or Q&A on a contract
// --------------------------------------------------------------------------
const ReviewChatSchema = z.object({
  contractId: z.string().min(1),
  message: z.string().min(1),
});

aiRouter.post('/review-chat', requireAuth, async (req, res, next) => {
  try {
    const { contractId, message } = ReviewChatSchema.parse(req.body);
    const userId = (req as any).userId as string;

    const contract = getContract(contractId);
    if (!contract) return res.status(404).json({ error: 'not_found', message: 'Contract not found' });

    let contractText = '';

    // Fetch contract text from Google Docs if available (skip for demo)
    if (contract.drive_file_id && contract.drive_file_id !== 'demo-mock-id' && userId !== 'demo-user') {
      try {
        const doc = await getDoc(userId, contract.drive_file_id);
        contractText = extractPlainText(doc);
      } catch {
        // Fall through with empty text — AI will still respond to the message
      }
    } else {
      // In demo mode, use field values as context
      const fields = typeof contract.field_values_json === 'string'
        ? JSON.parse(contract.field_values_json)
        : contract.field_values_json ?? {};
      contractText = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
    }

    const result = await reviewChat(contractText, message);

    // Apply edit to Google Doc if the AI returned one
    if (result.edited && result.edit && contract.drive_file_id !== 'demo-mock-id' && userId !== 'demo-user') {
      try {
        await replaceVariables(userId, contract.drive_file_id, {
          [result.edit.find]: result.edit.replace,
        });
      } catch {
        // Edit failed — still return the AI's reply
      }
    }

    res.json({ reply: result.reply, edited: result.edited });
  } catch (err) {
    next(err);
  }
});
