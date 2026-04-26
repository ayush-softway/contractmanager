// Softway ContractGen V2 — Shared Types
// Keep this package dependency-free (no runtime deps) so every surface can import it.

export type ISODateString = string;

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
export type ContractType = 'msa-sow' | 'sow-standalone' | 'change-order';
export type ContractStatus = 'draft' | 'generated' | 'sent' | 'signed';
export type ImportSource = 'hubspot' | 'drive' | 'text';

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
// API error shape
// --------------------------------------------------------------------------
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
