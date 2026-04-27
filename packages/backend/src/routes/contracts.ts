// Softway ContractGen V2 — Contracts Routes
//
// POST   /contracts/generate              — generate a new contract
// GET    /contracts/:id                   — get a single contract
// GET    /contracts                       — list all contracts for user
// POST   /contracts/:id/send-for-signature — mock DocuSign send

import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import { generateContractV2, getContract, listContracts, updateContractStatus, ValidationError } from '../services/contracts.js';
import { createEnvelope } from '../services/docusign.js';
import { exportAsPdf } from '../google/drive.js';
import { STARTERS } from '../services/starters.js';
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

// GET /contracts/:id — get single contract
contractsRouter.get('/:id', requireAuth, (req, res) => {
  const contract = getContract(String(req.params.id));
  if (!contract) return res.status(404).json({ error: 'not_found' });
  res.json({ contract });
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
    const fieldValues = typeof contract.field_values_json === 'string'
      ? JSON.parse(contract.field_values_json)
      : (contract.field_values_json ?? {});

    const signerEmail = fieldValues.client_contact_email || 'signer@example.com';
    const signerName = fieldValues.client_contact_name || 'Signer';

    let pdfBuffer: Buffer;
    try {
      if (contract.drive_file_id === 'demo-mock-id') {
        pdfBuffer = Buffer.from('mock-pdf');
      } else {
        pdfBuffer = await exportAsPdf(userId, contract.drive_file_id);
      }
    } catch (pdfErr) {
      // Error state: PDF export fails — contract is never lost
      return res.status(200).json({
        contract,
        warning: 'PDF export failed — open in Drive instead.',
        driveUrl: `https://docs.google.com/document/d/${contract.drive_file_id}/edit`,
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
        driveUrl: `https://docs.google.com/document/d/${contract.drive_file_id}/edit`,
      });
    }

    // Update contract status
    updateContractStatus(contract.id, 'sent', {
      docusign_envelope_id: envelope.envelopeId,
    });

    res.json({
      contract: { ...contract, status: 'sent', docusign_envelope_id: envelope.envelopeId },
      envelope,
      message: `✅ Envelope created — sent to ${signerEmail}`,
    });
  } catch (err) {
    next(err);
  }
});
