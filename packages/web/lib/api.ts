// Softway ContractGen V2 — API Client
//
// Clean V2 endpoints only. All requests go through Next's rewrite
// to the Express backend. Same-origin prefix means the session
// cookie is sent automatically.

import type {
  Contract,
  ImportResult,
  GenerateContractPayload,
  DocuSignEnvelope,
  User,
  StarterTemplate,
} from '@cg/shared';

const BASE = '/api/backend';

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // Auth
  me: () => req<{ user: User }>('/auth/me'),
  logout: () => req<{ ok: true }>('/auth/logout', { method: 'POST' }),

  // Import — unified source detection
  importDetect: (input: string) =>
    req<ImportResult>('/import/detect', {
      method: 'POST',
      body: JSON.stringify({ input }),
    }),

  // Starters catalog (no auth needed)
  listStarters: () => req<{ starters: StarterTemplate[] }>('/contracts/starters'),

  // Contract generation
  generateContract: (payload: GenerateContractPayload) =>
    req<{ contractId: string; driveFileId: string; previewUrl: string }>('/contracts/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Contract retrieval
  getContract: (id: string) => req<{ contract: Contract }>(`/contracts/${id}`),
  listContracts: () => req<{ contracts: Contract[] }>('/contracts'),

  // DocuSign
  sendForSignature: (contractId: string) =>
    req<{ contract: Contract; envelope: DocuSignEnvelope; message: string }>(
      `/contracts/${contractId}/send-for-signature`,
      { method: 'POST' },
    ),
};
