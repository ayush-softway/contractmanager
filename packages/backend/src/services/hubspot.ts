import { config } from '../config.js';
import type { ImportResult } from '@cg/shared';

const BASE = 'https://api.hubapi.com';

function hs(path: string) {
  if (!config.HUBSPOT_API_TOKEN) throw new Error('HUBSPOT_API_TOKEN not configured');
  return fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${config.HUBSPOT_API_TOKEN}`, 'Content-Type': 'application/json' },
  }).then(async (r) => {
    if (!r.ok) throw new Error(`HubSpot API error ${r.status}: ${await r.text()}`);
    return r.json() as Promise<any>;
  });
}

function hsPost(path: string, body: unknown) {
  if (!config.HUBSPOT_API_TOKEN) throw new Error('HUBSPOT_API_TOKEN not configured');
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.HUBSPOT_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`HubSpot API error ${r.status}: ${await r.text()}`);
    return r.json() as Promise<any>;
  });
}

// Parse "Key: Value" lines from deal description into contract fields
function parseDescription(description: string): Record<string, string> {
  const map: Record<string, string> = {
    'service type': 'service_type',
    'payment structure': 'payment_structure',
    'effective date': 'effective_date',
    'travel required': 'travel_required',
    'workshop count': 'workshop_count',
    'attendee count': 'attendee_count',
    'facilitator count': 'facilitator_count',
    'duration (hrs)': 'duration_hrs',
    'softway rep': 'softway_rep',
    'signature date': 'signature_date',
    'travel cap': 'travel_cap',
    'location': 'location',
  };
  const fields: Record<string, string> = {};
  for (const line of description.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const rawKey = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    const fieldKey = map[rawKey];
    if (fieldKey && value) fields[fieldKey] = value;
  }
  return fields;
}

export async function importFromHubSpot(dealId: string): Promise<ImportResult> {
  const deal = await hs(
    `/crm/v3/objects/deals/${dealId}?properties=dealname,amount,closedate,description,hubspot_owner_id`,
  );
  const props = deal.properties ?? {};

  const fields: Record<string, string> = {};

  if (props.amount) fields.project_fee_usd = String(props.amount).replace(/[^0-9.]/g, '');
  if (props.closedate) fields.completion_date = props.closedate.slice(0, 10);

  // Parse structured data from description
  if (props.description) {
    Object.assign(fields, parseDescription(props.description));
  }

  // Resolve deal owner → softway_rep (only if not already in description)
  if (!fields.softway_rep && props.hubspot_owner_id) {
    try {
      const owner = await hs(`/crm/v3/owners/${props.hubspot_owner_id}`);
      const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ');
      if (ownerName) fields.softway_rep = ownerName;
    } catch {}
  }

  // Associated contacts
  try {
    const assoc = await hs(`/crm/v3/objects/deals/${dealId}/associations/contacts`);
    const contactId = assoc.results?.[0]?.id;
    if (contactId) {
      const contact = await hs(
        `/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,jobtitle`,
      );
      const cp = contact.properties ?? {};
      const fullName = [cp.firstname, cp.lastname].filter(Boolean).join(' ');
      if (fullName) {
        fields.client_contact_name = fullName;
        // Use same person as signatory if not separately specified
        if (!fields.client_signatory_name) fields.client_signatory_name = fullName;
      }
      if (cp.email) fields.client_contact_email = cp.email;
      if (cp.jobtitle && !fields.client_signatory_title) fields.client_signatory_title = cp.jobtitle;
    }
  } catch {}

  // Associated companies
  try {
    const assoc = await hs(`/crm/v3/objects/deals/${dealId}/associations/companies`);
    const companyId = assoc.results?.[0]?.id;
    if (companyId) {
      const company = await hs(
        `/crm/v3/objects/companies/${companyId}?properties=name,address,city,state,zip`,
      );
      const cp = company.properties ?? {};
      if (cp.name) fields.client_legal_name = cp.name;
      const addr = [cp.address, cp.city, cp.state, cp.zip].filter(Boolean).join(', ');
      if (addr) fields.client_office_address = addr;
      // City as location if not in description
      if (cp.city && !fields.location) fields.location = `${cp.city}${cp.state ? `, ${cp.state}` : ''}`;
    }
  } catch {}

  const label = props.dealname ?? `Deal ${dealId}`;
  return { fields, source: 'hubspot', label };
}

export async function searchHubSpotDeals(
  query: string,
): Promise<{ dealId: string; dealName: string; amount: string; stage: string }[]> {
  const body = {
    filterGroups: [],
    query,
    properties: ['dealname', 'amount', 'hs_deal_stage'],
    limit: 10,
  };
  const result = await hsPost('/crm/v3/objects/deals/search', body);
  return (result.results ?? []).map((r: any) => ({
    dealId: r.id,
    dealName: r.properties?.dealname ?? r.id,
    amount: r.properties?.amount ?? '',
    stage: r.properties?.hs_deal_stage ?? '',
  }));
}
