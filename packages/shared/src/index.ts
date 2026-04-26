// Types shared across backend, web, and addon.
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
// Templates
// --------------------------------------------------------------------------
export interface TemplateVariable {
  /** Stable client-side ID used for drag-and-drop ordering. */
  id?: string;
  name: string;
  label?: string;
  defaultValue?: string;
  type?: 'text' | 'date' | 'number' | 'email';
  required?: boolean;
}

export interface TemplateSection {
  id: string;
  title: string;
  /** Whether this section must appear in every generated contract. */
  required: boolean;
  fields: TemplateVariable[];
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  /** Google Drive file ID — absent until the user opens/generates in Docs. */
  driveFileId?: string;
  sections: TemplateSection[];
  /** Flat list of all fields across sections; used by the generate form. */
  variables: TemplateVariable[];
  ownerId: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
}

export interface UpdateTemplateSectionsInput {
  sections: TemplateSection[];
}

// --------------------------------------------------------------------------
// Template-from-upload
//
// Build a template from an existing contract document. Source can be either
// a binary file (PDF/DOCX) sent via multipart, or a Google Doc the user has
// previously opened with our app (we can read it via Drive API).
// --------------------------------------------------------------------------
export type TemplateUploadSource =
  | { sourceType: 'file'; mimeType: string; filename: string }
  | { sourceType: 'google-doc'; fileId: string };

export interface CreateTemplateFromGoogleDocInput {
  sourceType: 'google-doc';
  fileId: string;
  name?: string;
  description?: string;
}

/**
 * Returned by POST /templates/from-upload. The template is fully registered
 * (with a Google Doc) by the time this is returned. `detectedVariables` is
 * the list of `{{var}}` names the AI introduced, useful for telling the user
 * what fields they'll fill in when generating contracts.
 */
export interface CreateTemplateFromUploadResult {
  template: Template;
  detectedVariables: string[];
}

// --------------------------------------------------------------------------
// Starter templates
//
// Bundled-with-the-app templates the user can import into their Drive in
// one click (MSA, SOW). Listed by GET /templates/starters; imported by
// POST /templates/starters/:slug/import.
// --------------------------------------------------------------------------
export interface StarterTemplate {
  slug: string;
  name: string;
  description: string;
}

// --------------------------------------------------------------------------
// Contracts
// --------------------------------------------------------------------------
export type ContractStatus =
  | 'draft'
  | 'reviewing'
  | 'sent_for_signature'
  | 'signed'
  | 'executed'
  | 'archived';

export interface Contract {
  id: string;
  templateId: string;
  title: string;
  driveFileId: string;
  status: ContractStatus;
  /** The values used when generating this contract from its template. */
  variableValues: Record<string, string>;
  docusignEnvelopeId?: string;
  pdfDriveFileId?: string;
  contractType?: 'msa-sow' | 'sow-standalone' | 'change-order';
  importSource?: { hubspotDealId?: string; driveDocId?: string; importedAt?: string };
  createdBy: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface GenerateContractInput {
  templateId: string;
  title: string;
  variableValues: Record<string, string>;
}

// --------------------------------------------------------------------------
// Contract drafts
//
// In-progress contracts that haven't been generated yet. Users create a draft
// when they start the "new contract" wizard, save partial variable values,
// and resume later. Finalizing a draft generates the real Contract (Drive
// doc + row in `contracts`) and deletes the draft.
// --------------------------------------------------------------------------
export interface ContractDraft {
  id: string;
  templateId: string;
  title: string;
  variableValues: Record<string, string>;
  createdBy: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CreateContractDraftInput {
  templateId: string;
  title: string;
  variableValues?: Record<string, string>;
}

export interface UpdateContractDraftInput {
  title?: string;
  variableValues?: Record<string, string>;
}

// --------------------------------------------------------------------------
// AI editing
// --------------------------------------------------------------------------
export interface AIEditRequest {
  /** Contract ID if editing a contract; optional if editing an arbitrary Doc from the add-on. */
  contractId?: string;
  /** Drive file ID (required — contracts and add-on-opened docs all have one). */
  driveFileId: string;
  /** Human instruction: "make this mutual", "tighten the termination clause". */
  instruction: string;
  /**
   * If provided, only edit this range. Indices are 1-based offsets into the
   * Doc per the Google Docs API convention.
   */
  range?: { startIndex: number; endIndex: number };
}

export interface AIEditResponse {
  /** The text the AI produced. */
  editedText: string;
  /** The range in the Doc that was modified. */
  appliedRange: { startIndex: number; endIndex: number };
  /** Tokens used, for usage reporting. */
  usage?: { inputTokens: number; outputTokens: number };
}

// --------------------------------------------------------------------------
// API error shape
// --------------------------------------------------------------------------
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
