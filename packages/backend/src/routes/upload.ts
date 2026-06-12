import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { analyzeRedlines, analyzeClientMSA } from '../services/ai.js';
import { db } from '../db/client.js';
import type { UploadAnalysis } from '@cg/shared';
import type { Request } from 'express';

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

// --------------------------------------------------------------------------
// POST /upload/j3a/finalize — create contract from resolved redlines
// --------------------------------------------------------------------------
const J3AFinalizeSchema = z.object({
  resolutions: z.record(z.enum(['accepted', 'rejected', 'countered'])),
  clauses: z.array(z.any()).optional(),
  title: z.string().optional(),
});

uploadRouter.post('/j3a/finalize', async (req, res, next) => {
  try {
    const { resolutions, clauses, title } = J3AFinalizeSchema.parse(req.body);
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized', message: 'Not signed in' });
    }
    const contractId = nanoid();
    const contractTitle = title ?? 'Resolved Redlines — Client MSA';

    const rows = Object.entries(resolutions).map(([id, action]) => {
      const clause = (clauses ?? []).find((c: any) => c.id === id);
      const name = clause?.name ?? `Clause ${id}`;
      return `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb">${name}</td><td style="padding:6px 12px;border:1px solid #e5e7eb;text-transform:capitalize">${action}</td></tr>`;
    }).join('');

    const renderedHtml = `<h1 style="font-size:1.5rem;margin-bottom:1rem">${contractTitle}</h1>
<p style="color:#6b7280;margin-bottom:1.5rem">The following client redlines have been resolved:</p>
<table style="border-collapse:collapse;width:100%"><thead><tr>
<th style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;text-align:left">Clause</th>
<th style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;text-align:left">Resolution</th>
</tr></thead><tbody>${rows}</tbody></table>`;

    db.prepare(`
      INSERT INTO contracts (id, user_id, title, contract_type, status, field_values_json, rendered_html_snapshot, drive_file_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(contractId, userId, contractTitle, 'msa', 'generated', JSON.stringify({ source: 'j3a-redlines', resolutions }), renderedHtml, null);

    res.json({ contractId });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// POST /upload/j3b/finalize — create SOW contract from MSA analysis
// --------------------------------------------------------------------------
const J3BFinalizeSchema = z.object({
  sowDraft: z.string().min(1),
  risks: z.array(z.any()).optional(),
  clientName: z.string().optional(),
});

uploadRouter.post('/j3b/finalize', async (req, res, next) => {
  try {
    const { sowDraft, risks, clientName } = J3BFinalizeSchema.parse(req.body);
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized', message: 'Not signed in' });
    }
    const contractId = nanoid();
    const contractTitle = clientName ? `SOW — ${clientName}` : 'Generated SOW — Client MSA';

    const renderedHtml = `<div style="font-family:Georgia,serif;line-height:1.7;max-width:800px">
<h1 style="font-size:1.5rem;margin-bottom:0.5rem">${contractTitle}</h1>
<p style="color:#6b7280;font-size:0.875rem;margin-bottom:2rem">Generated from client MSA analysis. ${risks?.length ?? 0} risk flag(s) addressed.</p>
<pre style="white-space:pre-wrap;font-family:Georgia,serif;font-size:0.9375rem">${sowDraft}</pre></div>`;

    db.prepare(`
      INSERT INTO contracts (id, user_id, title, contract_type, status, field_values_json, rendered_html_snapshot, drive_file_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(contractId, userId, contractTitle, 'sow-standalone', 'generated', JSON.stringify({ source: 'j3b-msa', risks }), renderedHtml, null);

    res.json({ contractId });
  } catch (err) {
    next(err);
  }
});
