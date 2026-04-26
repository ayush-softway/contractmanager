import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import { getHubSpotDeal } from '../services/hubspot.js';

export const hubspotRouter: Router = Router();

hubspotRouter.get('/deal/:dealId', requireAuth, async (req, res, next) => {
  try {
    const deal = await getHubSpotDeal(req.params.dealId as string);
    res.json(deal);
  } catch (err) {
    next(err);
  }
});
