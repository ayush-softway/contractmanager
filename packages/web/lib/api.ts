// Softway ContractGen V2 — API Client
//
// Clean V2 endpoints only. All requests go through Next's rewrite
// to the Express backend. Same-origin prefix means the session
// cookie is sent automatically.

import type {
  Contract,
  FieldDef,
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
  importFromDriveFile: (fileId: string) =>
    req<ImportResult>('/import/detect', {
      method: 'POST',
      body: JSON.stringify({ fileId }),
    }),
  searchHubSpotDeals: (q: string) =>
    req<{ deals: { dealId: string; dealName: string; amount: string; stage: string }[] }>(
      `/import/hubspot/search?q=${encodeURIComponent(q)}`,
    ),
  listDriveFiles: () =>
    req<{ files: { id: string; name: string; modifiedTime: string }[] }>('/import/drive/files'),

  // Starters catalog (no auth needed)
  listStarters: () => req<{ starters: StarterTemplate[] }>('/contracts/starters'),

  // Field definitions for a contract type (no auth needed)
  listFields: (contractType: string) =>
    req<{ fields: FieldDef[] }>(`/contracts/fields?type=${contractType}`),

  // Draft auto-save during intake
  saveDraft: (payload: { contractType: string; fields: Record<string, string>; draftId?: string }) =>
    req<{ contractId: string }>('/contracts/draft', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

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

  // Import — upload a file (PDF/DOCX) to extract contract fields
  importFile: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/import/file`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
      return res.json() as Promise<import('@cg/shared').ImportResult>;
    });
  },

  // Upload — analyze client document (J3A redlines or J3B client MSA)
  analyzeUpload: (payload: { text: string; driveFileId?: string; journey?: 'j3a' | 'j3b' }) =>
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

  // Upload — finalize J3A (create contract from resolved redlines)
  finalizeJ3A: (payload: { resolutions: Record<string, 'accepted' | 'rejected' | 'countered'>; clauses?: unknown[]; title?: string }) =>
    req<{ contractId: string }>('/upload/j3a/finalize', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Upload — finalize J3B (create SOW contract from MSA analysis)
  finalizeJ3B: (payload: { sowDraft: string; risks?: unknown[]; clientName?: string }) =>
    req<{ contractId: string }>('/upload/j3b/finalize', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Upload — context-aware chat for J3A/J3B review pages
  uploadChat: (journey: 'j3a' | 'j3b', context: unknown, question: string) =>
    req<{ reply: string }>('/ai/upload-chat', {
      method: 'POST',
      body: JSON.stringify({ journey, context, question }),
    }),

  // Import — extract raw text from PDF/DOCX/HTML (no AI, for upload modal)
  extractText: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/import/extract-text`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then(async (res) => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
      return res.json() as Promise<{ text: string }>;
    });
  },

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
