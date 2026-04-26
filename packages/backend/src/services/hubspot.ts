export async function getHubSpotDeal(dealId: string) {
  if (dealId === 'mock-pumpworks' || dealId === '123') {
    return {
      dealId: '123',
      client_legal_name: 'PumpWorks, LLC',
      client_address: '1000 Energy Way, Houston, TX 77002',
      client_contact_name: 'Sarah Jenkins',
      client_contact_email: 'sjenkins@pumpworks.com',
      softway_contact_name: 'Alex Rivera',
      project_fee_usd: '$85,000',
    };
  }
  throw new Error('Deal not found');
}
