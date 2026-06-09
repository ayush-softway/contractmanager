// Softway ContractGen V2 — Shared Types
// Keep this package dependency-free (no runtime deps) so every surface can import it.

export type ISODateString = string;

// --------------------------------------------------------------------------
// Field definitions (mirrors backend fields.ts — kept in sync manually)
// --------------------------------------------------------------------------
export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  types: string[];
  chips?: string[];
  format?: 'date' | 'currency' | 'email' | 'text';
}

// --------------------------------------------------------------------------
// User
// --------------------------------------------------------------------------
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: ISODateString;
}

// --------------------------------------------------------------------------
// Contract types
// --------------------------------------------------------------------------
export type ContractType = 'msa' | 'msa-sow' | 'sow-standalone' | 'change-order';
export type ContractStatus = 'draft' | 'generated' | 'sent' | 'signed';
export type ImportSource = 'hubspot' | 'drive' | 'text' | 'file';

// --------------------------------------------------------------------------
// Contract
// --------------------------------------------------------------------------
export interface Contract {
  id: string;
  userId: string;
  title: string;
  contractType: ContractType;
  status: ContractStatus;
  driveFileId?: string;
  pdfDriveFileId?: string;
  docusignEnvelopeId?: string;
  importSourceJson?: { source: ImportSource; label: string; importedAt: string };
  fieldValuesJson?: Record<string, string>;
  renderedHtmlSnapshot?: string;
  clauseChecksJson?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// --------------------------------------------------------------------------
// Import detection
// --------------------------------------------------------------------------
export interface ImportResult {
  fields: Partial<Record<string, string>>;
  source: ImportSource;
  label: string;
}

// --------------------------------------------------------------------------
// Generate contract payload
// --------------------------------------------------------------------------
export interface GenerateContractPayload {
  contractType: ContractType;
  fields: Record<string, string>;
}

// --------------------------------------------------------------------------
// DocuSign envelope
// --------------------------------------------------------------------------
export interface DocuSignEnvelope {
  envelopeId: string;
  status: 'created' | 'sent';
  sentAt: string;
}

// --------------------------------------------------------------------------
// Starter template (static catalog)
// --------------------------------------------------------------------------
export interface StarterTemplate {
  slug: string;
  label: string;
  description: string;
}

// --------------------------------------------------------------------------
// AI / Chat
// --------------------------------------------------------------------------
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface IntakeChatRequest {
  history: ChatMessage[];
  message: string;
  capturedFields?: Record<string, string>;
}

export interface IntakeChatResponse {
  reply: string;
  fields: Record<string, string>;
  ready: boolean;
}

export interface ReviewChatRequest {
  contractId: string;
  message: string;
}

export interface ReviewChatResponse {
  reply: string;
  edited: boolean;
  updatedHtml?: string;
  patch?: { field: string; newValue: string };
  clauseAction?: { type: 'add'; name: string; body: string } | { type: 'remove'; name: string };
}

// --------------------------------------------------------------------------
// Clause library
// --------------------------------------------------------------------------
export type ClauseType = 'non-negotiable' | 'flexible' | 'optional';

export interface Clause {
  id: string;
  name: string;
  type: ClauseType;
  body: string;
  updatedBy?: string;
  updatedAt: ISODateString;
}

// --------------------------------------------------------------------------
// Upload / Redline analysis
// --------------------------------------------------------------------------
export type ClauseVerdict = 'safe' | 'review' | 'conflict';

export interface RedlineClause {
  id: string;
  name: string;
  verdict: ClauseVerdict;
  explanation: string;
  resolution?: 'accepted' | 'rejected' | 'countered';
  counterText?: string;
}

export interface RedlineAnalysis {
  journey: 'j3a';
  clauses: RedlineClause[];
  driveFileId?: string;
}

export interface RiskFlag {
  clauseName: string;
  risk: string;
  softwayVersion: string;
}

export interface ClientMSAAnalysis {
  journey: 'j3b';
  risks: RiskFlag[];
  sowDraft: string;
  driveFileId?: string;
}

export type UploadAnalysis = RedlineAnalysis | ClientMSAAnalysis;

// --------------------------------------------------------------------------
// API error shape
// --------------------------------------------------------------------------
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
