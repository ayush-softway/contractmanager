export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  types: string[];
  chips?: string[];
  format?: 'date' | 'currency' | 'email' | 'text';
}

export const FIELD_DEFS: FieldDef[] = [
  // Required for all types
  { key: 'client_legal_name',     label: 'Client Legal Name',      required: true,  types: ['*'], format: 'text' },
  { key: 'client_office_address', label: 'Client Address',         required: true,  types: ['*'], format: 'text' },
  { key: 'softway_rep',           label: 'Softway Rep',            required: true,  types: ['*'], format: 'text' },
  { key: 'project_fee_usd',       label: 'Project Fee (USD)',      required: true,  types: ['*'], format: 'currency' },
  { key: 'completion_date',       label: 'Completion Date',        required: true,  types: ['*'], format: 'date' },
  { key: 'service_type',          label: 'Service Description',    required: true,  types: ['*'], format: 'text' },
  // msa-sow only
  { key: 'effective_date',         label: 'MSA Effective Date',     required: true,  types: ['msa-sow'], format: 'date' },
  { key: 'client_contact_name',    label: 'Client Contact Name',    required: true,  types: ['msa-sow'], format: 'text' },
  { key: 'client_contact_email',   label: 'Client Contact Email',   required: true,  types: ['msa-sow'], format: 'email' },
  { key: 'client_signatory_name',  label: 'Client Signatory Name',  required: true,  types: ['msa-sow'], format: 'text' },
  { key: 'client_signatory_title', label: 'Client Signatory Title', required: true,  types: ['msa-sow'], format: 'text' },
  // sow-standalone only
  { key: 'msa_date',    label: 'Existing MSA Date', required: true, types: ['sow-standalone'], format: 'date' },
  { key: 'sow_number',  label: 'SOW Number',         required: true, types: ['sow-standalone', 'change-order'], format: 'text' },
  // change-order only
  { key: 'change_description', label: 'Description of Changes', required: true, types: ['change-order'], format: 'text' },
  { key: 'original_fee_usd',   label: 'Original Fee (USD)',     required: true, types: ['change-order'], format: 'currency' },
  // Optional for all
  { key: 'payment_structure', label: 'Payment Structure', required: false, types: ['*'], format: 'text' },
  { key: 'location',          label: 'Location',           required: false, types: ['*'], format: 'text' },
  { key: 'travel_required',   label: 'Travel Required',    required: false, types: ['*'], chips: ['Yes', 'No'] },
  { key: 'travel_cap',        label: 'Travel Cap (USD)',   required: false, types: ['*'], format: 'currency' },
  { key: 'workshop_count',    label: 'Workshop Count',     required: false, types: ['*'], format: 'text' },
  { key: 'attendee_count',    label: 'Attendee Count',     required: false, types: ['*'], chips: ['Under 25', '25–50', '50–100', '100+'] },
  { key: 'facilitator_count', label: 'Facilitator Count',  required: false, types: ['*'], format: 'text' },
  { key: 'duration_hrs',      label: 'Duration (hrs)',     required: false, types: ['*'], format: 'text' },
  { key: 'signature_date',    label: 'Signature Date',     required: false, types: ['*'], format: 'date' },
];

export function getRequiredFields(contractType: string): FieldDef[] {
  return FIELD_DEFS.filter(f => f.required && (f.types.includes('*') || f.types.includes(contractType)));
}

export function getAllFieldsForType(contractType: string): FieldDef[] {
  return FIELD_DEFS.filter(f => f.types.includes('*') || f.types.includes(contractType));
}

export function getRequiredKeys(contractType: string): string[] {
  return getRequiredFields(contractType).map(f => f.key);
}
