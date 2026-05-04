import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs';
import { marked } from 'marked';
import { requireAuth } from '../auth/session.js';
import { getContract } from '../services/contracts.js';
import { intakeChat, reviewChat, verifyClauseCoverage } from '../services/ai.js';
import { getStarter, getStarterMdPath } from '../services/starters.js';
import { db } from '../db/client.js';

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

    const contract = getContract(contractId);
    if (!contract) return res.status(404).json({ error: 'not_found', message: 'Contract not found' });

    const fields: Record<string, string> = typeof contract.field_values_json === 'string'
      ? JSON.parse(contract.field_values_json)
      : (contract.field_values_json ?? {});

    const result = await reviewChat(fields, message);

    if (result.edited && result.patch) {
      const { field, newValue } = result.patch;
      fields[field] = newValue;

      // Re-render HTML from .md template with updated fields
      const starter = getStarter(contract.contract_type);
      if (starter) {
        const mdPath = getStarterMdPath(starter);
        let markdown = fs.readFileSync(mdPath, 'utf-8');
        const fieldMap = new Map(Object.entries(fields).map(([k, v]) => [k.toLowerCase(), String(v)]));
        markdown = markdown.replace(/\{\{(\w+)\}\}/g, (_, key) =>
          fieldMap.get(key.toLowerCase()) ?? `[${key} not provided]`
        );
        const updatedHtml = await marked.parse(markdown);

        // Re-run clause checks on updated HTML
        const clauses = db.prepare('SELECT * FROM clauses').all() as any[];
        const clauseChecks = await verifyClauseCoverage(updatedHtml, clauses);

        db.prepare(`
          UPDATE contracts
          SET field_values_json = ?, rendered_html_snapshot = ?, clause_checks_json = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(JSON.stringify(fields), updatedHtml, JSON.stringify(clauseChecks), contract.id);

        return res.json({ reply: result.reply, edited: true, updatedHtml, patch: result.patch });
      }
    }

    res.json({ reply: result.reply, edited: false });
  } catch (err) {
    next(err);
  }
});
