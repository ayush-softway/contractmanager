// Softway ContractGen V2 — Contracts Routes
//
// POST   /contracts/generate              — generate a new contract
// GET    /contracts/:id                   — get a single contract
// GET    /contracts                       — list all contracts for user
// POST   /contracts/:id/send-for-signature — mock DocuSign send

import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import { generateContractV2, getContract, listContracts, updateContractStatus, upsertDraft, ValidationError } from '../services/contracts.js';
import { createEnvelope } from '../services/docusign.js';
import { exportAsPdf } from '../google/drive.js';
import { STARTERS, getFieldsForType } from '../services/starters.js';
import { db } from '../db/client.js';
import type { Request } from 'express';

export const contractsRouter: Router = Router();

// GET /contracts — list all user contracts
contractsRouter.get('/', requireAuth, (req, res) => {
  const userId = (req as Request & { userId: string }).userId;
  const contracts = listContracts(userId);
  res.json({ contracts });
});

// GET /contracts/starters — list available starter templates (no auth needed)
contractsRouter.get('/starters', (_req, res) => {
  res.json({
    starters: STARTERS.map(s => ({
      slug: s.slug,
      label: s.label,
      description: s.description,
    })),
  });
});

// GET /contracts/fields?type=msa-sow — field definitions for a contract type
contractsRouter.get('/fields', (_req, res) => {
  const type = String(_req.query.type ?? 'msa-sow');
  res.json({ fields: getFieldsForType(type) });
});

// GET /contracts/:id — get single contract
contractsRouter.get('/:id', requireAuth, (req, res) => {
  const contract = getContract(String(req.params.id));
  if (!contract) return res.status(404).json({ error: 'not_found' });
  res.json({ contract });
});

// PUT /contracts/draft — upsert a draft contract during intake
contractsRouter.put('/draft', requireAuth, (req, res) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { contractType, fields, draftId } = req.body;
    if (!contractType || !fields) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    const contractId = upsertDraft(userId, contractType, fields, draftId);
    res.json({ contractId });
  } catch (err) {
    res.status(500).json({ error: 'draft_failed' });
  }
});

// PATCH /contracts/:id/html — update rendered HTML snapshot (inline editing)
contractsRouter.patch('/:id/html', requireAuth, (req, res) => {
  try {
    const { html } = req.body;
    if (typeof html !== 'string') {
      return res.status(400).json({ error: 'missing_html' });
    }
    db.prepare(`UPDATE contracts SET rendered_html_snapshot = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(html, String(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'update_failed' });
  }
});

// POST /contracts/generate — create a new contract from template
contractsRouter.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const { contractType, fields } = req.body;

    if (!contractType || !fields) {
      return res.status(400).json({ error: 'missing_fields', message: 'contractType and fields are required.' });
    }

    const result = await generateContractV2(userId, contractType, fields);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: 'validation_error', message: err.message });
    }
    next(err);
  }
});

// POST /contracts/:id/send-for-signature — export PDF + mock DocuSign
contractsRouter.post('/:id/send-for-signature', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as Request & { userId: string }).userId;
    const contract = getContract(String(req.params.id));

    if (!contract) {
      return res.status(404).json({ error: 'not_found' });
    }

    // Parse field values to get signer info
    const fieldValues = typeof contract.fieldValuesJson === 'string'
      ? JSON.parse(contract.fieldValuesJson)
      : (contract.fieldValuesJson ?? {});

    const signerEmail = fieldValues.client_contact_email || 'signer@example.com';
    const signerName = fieldValues.client_contact_name || 'Signer';

    let pdfBuffer: Buffer;
    try {
      if (contract.driveFileId === 'demo-mock-id') {
        pdfBuffer = Buffer.from('mock-pdf');
      } else {
        pdfBuffer = await exportAsPdf(userId, contract.driveFileId);
      }
    } catch (pdfErr) {
      // Error state: PDF export fails — contract is never lost
      return res.status(200).json({
        contract,
        warning: 'PDF export failed — open in Drive instead.',
        driveUrl: `https://docs.google.com/document/d/${contract.driveFileId}/edit`,
      });
    }

    let envelope;
    try {
      envelope = await createEnvelope(contract.id, signerEmail, signerName, pdfBuffer);
    } catch (dsErr) {
      // Error state: DocuSign mock fails — contract saved to Drive
      return res.status(200).json({
        contract,
        warning: 'DocuSign unavailable — contract saved to Drive. Send manually.',
        driveUrl: `https://docs.google.com/document/d/${contract.driveFileId}/edit`,
      });
    }

    // Update contract status
    updateContractStatus(contract.id, 'sent', {
      docusign_envelope_id: envelope.envelopeId,
    });

    res.json({
      contract: { ...contract, status: 'sent', docusignEnvelopeId: envelope.envelopeId },
      envelope,
      message: `✅ Envelope created — sent to ${signerEmail}`,
    });
  } catch (err) {
    next(err);
  }
});
