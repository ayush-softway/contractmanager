import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/session.js';
import {
  finalizeContractDraft,
  generateContract,
  getContract,
  listContracts,
  updateContractStatus,
} from '../services/contracts.js';
import {
  createContractDraft,
  deleteContractDraft,
  getContractDraft,
  listContractDrafts,
  updateContractDraft,
} from '../services/contractDrafts.js';
import { exportAsPdf } from '../google/drive.js';
import { createDocusignEnvelope } from '../services/docusign.js';

export const contractsRouter: Router = Router();

const GenerateBody = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1).max(300),
  variableValues: z.record(z.string()),
});

const StatusBody = z.object({
  status: z.enum(['draft', 'reviewing', 'sent_for_signature', 'signed', 'executed', 'archived']),
});

const CreateDraftBody = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1).max(300),
  variableValues: z.record(z.string()).optional(),
});

const UpdateDraftBody = z.object({
  title: z.string().min(1).max(300).optional(),
  variableValues: z.record(z.string()).optional(),
});

contractsRouter.get('/', requireAuth, (req, res) => {
  const userId = (req as unknown as { userId: string }).userId;
  res.json({ contracts: listContracts(userId) });
});

contractsRouter.post('/generate', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    const body = GenerateBody.parse(req.body);
    const contract = await generateContract(userId, body);
    res.status(201).json({ contract });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// Drafts — in-progress contracts the user is still filling out.
//
// IMPORTANT: these `/drafts*` routes must be registered BEFORE `/:id` so the
// literal segment is matched first.
// --------------------------------------------------------------------------

contractsRouter.get('/drafts', requireAuth, (req, res) => {
  const userId = (req as unknown as { userId: string }).userId;
  res.json({ drafts: listContractDrafts(userId) });
});

contractsRouter.post('/drafts', requireAuth, (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    const body = CreateDraftBody.parse(req.body);
    const draft = createContractDraft(userId, body);
    res.status(201).json({ draft });
  } catch (err) {
    next(err);
  }
});

contractsRouter.get('/drafts/:id', requireAuth, (req, res) => {
  const userId = (req as unknown as { userId: string }).userId;
  const draft = getContractDraft(userId, String(req.params.id));
  if (!draft) return res.status(404).json({ error: 'not_found' });
  res.json({ draft });
});

contractsRouter.patch('/drafts/:id', requireAuth, (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    const body = UpdateDraftBody.parse(req.body);
    const draft = updateContractDraft(userId, String(req.params.id), body);
    res.json({ draft });
  } catch (err) {
    next(err);
  }
});

contractsRouter.delete('/drafts/:id', requireAuth, (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    deleteContractDraft(userId, String(req.params.id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

contractsRouter.post('/drafts/:id/finalize', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    const contract = await finalizeContractDraft(userId, String(req.params.id));
    res.status(201).json({ contract });
  } catch (err) {
    next(err);
  }
});

contractsRouter.get('/:id', requireAuth, (req, res) => {
  const userId = (req as unknown as { userId: string }).userId;
  const contract = getContract(userId, String(req.params.id));
  if (!contract) return res.status(404).json({ error: 'not_found' });
  res.json({ contract });
});

contractsRouter.patch('/:id/status', requireAuth, (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    const body = StatusBody.parse(req.body);
    const contract = updateContractStatus(userId, String(req.params.id), body.status);
    if (!contract) return res.status(404).json({ error: 'not_found' });
    res.json({ contract });
  } catch (err) {
    next(err);
  }
});

contractsRouter.post('/:id/send-for-signature', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    const contractId = String(req.params.id);
    const contract = getContract(userId, contractId);
    if (!contract) return res.status(404).json({ error: 'not_found' });
    
    const { signerEmail, signerName } = req.body;
    
    // 1. Export as PDF
    const pdfBuffer = await exportAsPdf(userId, contract.driveFileId);
    
    // 2. Send via DocuSign mock
    const envelope = await createDocusignEnvelope(contractId, pdfBuffer, signerEmail, signerName);
    
    // 3. Update contract
    const updatedContract = updateContractStatus(userId, contractId, 'sent_for_signature');
    
    res.json({ contract: updatedContract, envelope });
  } catch (err) {
    next(err);
  }
});
