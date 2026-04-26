import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import { getHubSpotDeal } from '../services/hubspot.js';
import { extractDriveFields } from '../services/driveImport.js';

export const importDetectRouter: Router = Router();

importDetectRouter.post('/', async (req, res, next) => {
  try {
    const { input } = req.body;
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'invalid_input' });
    }

    // HubSpot URL detection
    if (input.includes('app.hubspot.com')) {
      // Very naive deal ID extraction from URL
      const match = input.match(/\/deal\/([a-zA-Z0-9-]+)/);
      const dealId = match ? match[1] : input.trim();
      const deal = await getHubSpotDeal(dealId);
      
      const fields = {
        client_legal_name: deal.client_legal_name,
        client_address: deal.client_address,
        client_contact_name: deal.client_contact_name,
        client_contact_email: deal.client_contact_email,
        softway_contact_name: deal.softway_contact_name,
        project_fee_usd: deal.project_fee_usd,
      };
      
      return res.json({ fields, source: 'hubspot', label: `HubSpot Deal: ${deal.client_legal_name}` });
    }

    // Google Drive URL detection
    if (input.includes('docs.google.com')) {
      // In a real app we'd fetch the doc content via Drive API
      // Here we just mock it using extractDriveFields with a dummy string
      // because we don't have the text of the actual Google doc here
      const fields = await extractDriveFields('MSA Effective Date: ' + new Date().toLocaleDateString());
      return res.json({ fields, source: 'drive', label: 'Google Doc Link' });
    }

    // Default: Raw text paste
    const fields = await extractDriveFields(input);
    return res.json({ fields, source: 'text', label: 'Pasted Notes' });
  } catch (err) {
    next(err);
  }
});
