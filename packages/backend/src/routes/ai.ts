import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs';
import { marked } from 'marked';
import { requireAuth } from '../auth/session.js';
import { getContract } from '../services/contracts.js';
import { intakeChat, reviewChat, verifyClauseCoverage, uploadChat } from '../services/ai.js';
import { getStarter, getStarterMdPath } from '../services/starters.js';
import { db } from '../db/client.js';
import { appendText } from '../google/docs.js';
import { docsFor } from '../google/clients.js';

export const aiRouter = Router();

// --------------------------------------------------------------------------
// POST /ai/intake — conversational intake turn
// --------------------------------------------------------------------------
const IntakeSchema = z.object({
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
  message: z.string().min(1),
  capturedFields: z.record(z.string()).optional(),
});

aiRouter.post('/intake', async (req, res, next) => {
  try {
    const { history, message, capturedFields } = IntakeSchema.parse(req.body);
    const result = await intakeChat(history, message, capturedFields);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// POST /ai/upload-chat — context-aware Q&A for J3A/J3B review pages
// --------------------------------------------------------------------------
const UploadChatSchema = z.object({
  journey: z.enum(['j3a', 'j3b']),
  context: z.unknown(),
  question: z.string().min(1),
});

aiRouter.post('/upload-chat', async (req, res, next) => {
  try {
    const { journey, context, question } = UploadChatSchema.parse(req.body);
    const result = await uploadChat(journey, context as object, question);
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
    const userId = (req as Request & { userId: string }).userId;

    const contract = getContract(contractId);
    if (!contract) return res.status(404).json({ error: 'not_found', message: 'Contract not found' });

    const isDemoDoc = !contract.driveFileId || contract.driveFileId === 'demo-mock-id';

    const fields: Record<string, string> = typeof contract.fieldValuesJson === 'string'
      ? JSON.parse(contract.fieldValuesJson)
      : (contract.fieldValuesJson ?? {});

    // Strip internal tracking key before sending to AI
    const fieldsForAi = { ...fields };
    delete fieldsForAi.__clause_modifications;

    const result = await reviewChat(fieldsForAi, message);

    // --- FIELD EDIT (patch) ---
    if (result.edited && result.patch) {
      const { field, newValue } = result.patch;
      const oldValue = fields[field]; // capture BEFORE overwrite
      fields[field] = newValue;

      const starter = getStarter(contract.contractType);
      if (starter) {
        const mdPath = getStarterMdPath(starter);
        let markdown = fs.readFileSync(mdPath, 'utf-8');
        const fieldMap = new Map(Object.entries(fields).map(([k, v]) => [k.toLowerCase(), String(v)]));
        markdown = markdown.replace(/\{\{(\w+)\}\}/g, (_, key) =>
          fieldMap.get(key.toLowerCase()) ?? `{{${key}}}`
        );
        let updatedHtml = await marked.parse(markdown);

        const clauseMods: Array<{ type: 'add' | 'remove'; name: string; body?: string }> =
          fields.__clause_modifications ? JSON.parse(fields.__clause_modifications) : [];

        for (const mod of clauseMods) {
          if (mod.type === 'add' && mod.body) {
            const clauseHtml = `<h2>${mod.name}</h2>\n<p>${mod.body.replace(/\n/g, '</p>\n<p>')}</p>\n`;
            const sigIdx = updatedHtml.lastIndexOf('<h2>Signat');
            updatedHtml = sigIdx > 0
              ? updatedHtml.slice(0, sigIdx) + clauseHtml + updatedHtml.slice(sigIdx)
              : updatedHtml + '\n' + clauseHtml;
          } else if (mod.type === 'remove') {
            const esc = mod.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            updatedHtml = updatedHtml.replace(
              new RegExp(`<h2>\\s*${esc}\\s*</h2>[\\s\\S]*?(?=<h2>|$)`, 'i'), '',
            );
          }
        }

        // Sync field edit to live Google Doc (best-effort, skip in demo)
        if (!isDemoDoc && oldValue && oldValue !== newValue) {
          try {
            const docs = docsFor(userId);
            await docs.documents.batchUpdate({
              documentId: contract.driveFileId,
              requestBody: {
                requests: [{
                  replaceAllText: {
                    containsText: { text: oldValue, matchCase: false },
                    replaceText: newValue,
                  },
                }],
              },
            });
          } catch (syncErr) {
            console.error('Google Docs field sync failed (non-fatal):', syncErr);
          }
        }

        const clauses = db.prepare('SELECT * FROM clauses').all() as any[];
        const clauseChecks = await verifyClauseCoverage(updatedHtml, clauses);

        db.prepare(`
          UPDATE contracts
          SET field_values_json = ?, rendered_html_snapshot = ?, clause_checks_json = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(JSON.stringify(fields), updatedHtml, JSON.stringify(clauseChecks), contract.id);

        return res.json({ reply: result.reply, edited: true, updatedHtml, patch: result.patch, clauseChecks });
      }
    }

    // --- CLAUSE ADD / REMOVE ---
    if (result.edited && result.clauseAction) {
      const action = result.clauseAction;
      let currentHtml: string = typeof contract.renderedHtmlSnapshot === 'string'
        ? contract.renderedHtmlSnapshot
        : '';

      const clauseMods: Array<{ type: 'add' | 'remove'; name: string; body?: string }> =
        fields.__clause_modifications ? JSON.parse(fields.__clause_modifications) : [];

      let updatedHtml = currentHtml;

      if (action.type === 'add') {
        clauseMods.push({ type: 'add', name: action.name, body: action.body });
        const clauseHtml = `<h2>${action.name}</h2>\n<p>${action.body.replace(/\n/g, '</p>\n<p>')}</p>\n`;
        const sigIdx = currentHtml.lastIndexOf('<h2>Signat');
        updatedHtml = sigIdx > 0
          ? currentHtml.slice(0, sigIdx) + clauseHtml + currentHtml.slice(sigIdx)
          : currentHtml + '\n' + clauseHtml;

        // Sync clause to live Google Doc (best-effort)
        if (!isDemoDoc) {
          try {
            await appendText(userId, contract.driveFileId, `\n\n${action.name}\n${action.body}\n`);
          } catch (syncErr) {
            console.error('Google Docs clause sync failed (non-fatal):', syncErr);
          }
        }
      } else if (action.type === 'remove') {
        clauseMods.push({ type: 'remove', name: action.name });
        const escapedName = action.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        updatedHtml = currentHtml.replace(
          new RegExp(`<h2>\\s*${escapedName}\\s*</h2>[\\s\\S]*?(?=<h2>|$)`, 'i'),
          '',
        );
      }

      fields.__clause_modifications = JSON.stringify(clauseMods);

      const clauses = db.prepare('SELECT * FROM clauses').all() as any[];
      const clauseChecks = await verifyClauseCoverage(updatedHtml, clauses);

      db.prepare(`
        UPDATE contracts
        SET rendered_html_snapshot = ?, clause_checks_json = ?, field_values_json = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(updatedHtml, JSON.stringify(clauseChecks), JSON.stringify(fields), contract.id);

      return res.json({ reply: result.reply, edited: true, updatedHtml, clauseAction: action, clauseChecks });
    }

    res.json({ reply: result.reply, edited: false });
  } catch (err) {
    next(err);
  }
});
