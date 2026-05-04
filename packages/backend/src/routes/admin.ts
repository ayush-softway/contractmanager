import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import type { Clause } from '@cg/shared';

export const adminRouter = Router();

function rowToClause(row: any): Clause {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    body: row.body,
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at,
  };
}

// --------------------------------------------------------------------------
// GET /admin/clauses — list all clauses
// --------------------------------------------------------------------------
adminRouter.get('/clauses', (_req, res) => {
  const rows = db.prepare('SELECT * FROM clauses ORDER BY name ASC').all();
  res.json({ clauses: rows.map(rowToClause) });
});

// --------------------------------------------------------------------------
// POST /admin/clauses — create a new clause
// --------------------------------------------------------------------------
const ClauseBodySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['non-negotiable', 'flexible', 'optional']),
  body: z.string().min(1),
  updatedBy: z.string().optional(),
});

adminRouter.post('/clauses', (req, res, next) => {
  try {
    const data = ClauseBodySchema.parse(req.body);
    const id = nanoid();
    db.prepare(`
      INSERT INTO clauses (id, name, type, body, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, data.name, data.type, data.body, data.updatedBy ?? null);
    const row = db.prepare('SELECT * FROM clauses WHERE id = ?').get(id) as any;
    res.status(201).json({ clause: rowToClause(row) });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// PUT /admin/clauses/:id — update a clause
// --------------------------------------------------------------------------
adminRouter.put('/clauses/:id', (req, res, next) => {
  try {
    const data = ClauseBodySchema.partial().parse(req.body);
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM clauses WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'not_found', message: 'Clause not found' });

    const sets: string[] = ["updated_at = datetime('now')"];
    const values: any[] = [];
    if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
    if (data.type !== undefined) { sets.push('type = ?'); values.push(data.type); }
    if (data.body !== undefined) { sets.push('body = ?'); values.push(data.body); }
    if (data.updatedBy !== undefined) { sets.push('updated_by = ?'); values.push(data.updatedBy); }

    values.push(id);
    db.prepare(`UPDATE clauses SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    const row = db.prepare('SELECT * FROM clauses WHERE id = ?').get(id) as any;
    res.json({ clause: rowToClause(row) });
  } catch (err) {
    next(err);
  }
});
