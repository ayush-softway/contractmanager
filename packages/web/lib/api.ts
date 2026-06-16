import type {
  Contract,
  ContractDraft,
  CreateContractDraftInput,
  CreateTemplateFromGoogleDocInput,
  CreateTemplateFromUploadResult,
  StarterTemplate,
  Template,
  TemplateSection,
  UpdateContractDraftInput,
  User,
  AIEditRequest,
  AIEditResponse,
  GenerateContractInput,
} from '@cg/shared';

// All requests go through Next's rewrite to the Express backend. Using a
// same-origin prefix means the session cookie is sent automatically.
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
  me: () => req<{ user: User }>('/auth/me'),
  logout: () => req<{ ok: true }>('/auth/logout', { method: 'POST' }),

  listTemplates: () => req<{ templates: Template[] }>('/templates'),
  getTemplate: (id: string) => req<{ template: Template }>(`/templates/${id}`),
  createTemplate: (body: { name: string; description?: string }) =>
    req<{ template: Template }>('/templates', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateTemplateSections: (id: string, sections: TemplateSection[]) =>
    req<{ template: Template }>(`/templates/${id}/sections`, {
      method: 'PATCH',
      body: JSON.stringify({ sections }),
    }),
  syncTemplate: (id: string) =>
    req<{ template: Template }>(`/templates/${id}/sync`, { method: 'POST' }),
  deleteTemplate: (id: string) => req<void>(`/templates/${id}`, { method: 'DELETE' }),

  /**
   * Upload a PDF or DOCX and have the backend turn it into a template.
   * The `name` is optional — the backend will derive one from the filename
   * if omitted. Progress is not streamed; the response resolves once the
   * Google Doc has been created and seeded.
   */
  createTemplateFromFile: async (
    file: File,
    meta?: { name?: string; description?: string },
  ): Promise<CreateTemplateFromUploadResult> => {
    const form = new FormData();
    form.append('file', file);
    if (meta?.name) form.append('name', meta.name);
    if (meta?.description) form.append('description', meta.description);
    const res = await fetch(`${BASE}/templates/from-upload`, {
      method: 'POST',
      credentials: 'include',
      body: form, // don't set Content-Type; the browser adds the boundary
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
    return (await res.json()) as CreateTemplateFromUploadResult;
  },

  /**
   * Build a template from a Google Doc the user has already opened with
   * this app. The backend reads the Doc via the Drive API.
   */
  createTemplateFromGoogleDoc: (body: CreateTemplateFromGoogleDocInput) =>
    req<CreateTemplateFromUploadResult>('/templates/from-upload', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ---- Starter templates (bundled MSA / SOW) ----
  listStarters: () => req<{ starters: StarterTemplate[] }>('/templates/starters'),
  importStarter: (slug: string) =>
    req<CreateTemplateFromUploadResult>(`/templates/starters/${slug}/import`, {
      method: 'POST',
    }),

  listContracts: () => req<{ contracts: Contract[] }>('/contracts'),
  getContract: (id: string) => req<{ contract: Contract }>(`/contracts/${id}`),
  generateContract: (body: GenerateContractInput) =>
    req<{ contract: Contract }>('/contracts/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // ---- Contract drafts (work-in-progress, resumable wizards) ----
  listContractDrafts: () => req<{ drafts: ContractDraft[] }>('/contracts/drafts'),
  getContractDraft: (id: string) =>
    req<{ draft: ContractDraft }>(`/contracts/drafts/${id}`),
  createContractDraft: (body: CreateContractDraftInput) =>
    req<{ draft: ContractDraft }>('/contracts/drafts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateContractDraft: (id: string, body: UpdateContractDraftInput) =>
    req<{ draft: ContractDraft }>(`/contracts/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteContractDraft: (id: string) =>
    req<void>(`/contracts/drafts/${id}`, { method: 'DELETE' }),
  finalizeContractDraft: (id: string) =>
    req<{ contract: Contract }>(`/contracts/drafts/${id}/finalize`, { method: 'POST' }),

  updateContractStatus: (id: string, status: string) =>
    req<{ contract: Contract }>(`/contracts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  aiEdit: (body: AIEditRequest) =>
    req<AIEditResponse>('/ai/edit', { method: 'POST', body: JSON.stringify(body) }),
};
