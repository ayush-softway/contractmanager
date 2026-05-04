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
  ChatMessage,
  IntakeChatRequest,
  IntakeChatResponse,
  ReviewChatResponse,
  UploadAnalysis,
  Clause,
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

  // AI — conversational intake
  intakeChat: (payload: IntakeChatRequest) =>
    req<IntakeChatResponse>('/ai/intake', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // AI — review screen chat (edit + Q&A)
  reviewChat: (contractId: string, message: string) =>
    req<ReviewChatResponse>('/ai/review-chat', {
      method: 'POST',
      body: JSON.stringify({ contractId, message }),
    }),

  // Upload — analyze client document
  analyzeUpload: (payload: { text: string; driveFileId?: string }) =>
    req<UploadAnalysis>('/upload/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Upload — J3A clause resolution
  resolveClause: (payload: { clauseId: string; action: 'accepted' | 'rejected' | 'countered'; counterText?: string }) =>
    req<{ ok: true }>('/upload/j3a/resolve', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Admin — clause library
  listClauses: () => req<{ clauses: Clause[] }>('/admin/clauses'),
  updateClause: (id: string, body: Partial<Clause>) =>
    req<{ clause: Clause }>(`/admin/clauses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  createClause: (body: Omit<Clause, 'id' | 'updatedAt'>) =>
    req<{ clause: Clause }>('/admin/clauses', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
