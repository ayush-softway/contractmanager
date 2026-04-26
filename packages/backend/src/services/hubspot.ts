// Softway ContractGen V2 — HubSpot Mock Service
//
// V2 PROTOTYPE MOCK — returns hardcoded PumpWorks deal data.
// Replace with real HubSpot Private App API call post-demo.

import type { ImportResult } from '@cg/shared';

export async function importFromHubSpot(dealId: string): Promise<ImportResult> {
  // For the demo, any dealId returns PumpWorks data
  return {
    fields: {
      client_legal_name: 'DXP Enterprises, Inc. dba PumpWorks',
      client_address: '1234 Industrial Blvd, Houston, TX 77001',
      client_contact_name: 'John Smith',
      client_contact_email: 'jsmith@pumpworks.com',
      softway_rep: 'Ashley Rodriguez',
      project_fee_usd: '150000',
      sow_number: 'SOW-2026-PW-01',
      contract_date: new Date().toLocaleDateString('en-US'),
    },
    source: 'hubspot',
    label: 'PumpWorks 2026 Culture Solution',
  };
}
