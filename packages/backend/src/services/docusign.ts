// Softway ContractGen V2 — DocuSign Mock Service
//
// V2 PROTOTYPE MOCK — simulates DocuSign envelope creation.
// Replace with real DocuSign eSignature API post-demo.

export interface DocuSignEnvelope {
  envelopeId: string;
  status: 'created' | 'sent';
  sentAt: string;
}

export async function createEnvelope(
  contractId: string,
  signerEmail: string,
  signerName: string,
  pdfBuffer: Buffer,
): Promise<DocuSignEnvelope> {
  // V2 PROTOTYPE MOCK — replace with real DocuSign eSignature API post-demo
  return {
    envelopeId: `ENV-MOCK-${Date.now()}`,
    status: 'sent',
    sentAt: new Date().toISOString(),
  };
}
