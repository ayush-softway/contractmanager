// Softway ContractGen V2 — Starter Templates (Layer 1: Locked Content)
//
// These templates were converted from .md → .docx via pandoc.
// Legal has approved the content. Nobody edits the source templates.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllFieldsForType, getRequiredKeys } from './fields.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface Starter {
  slug: string;
  label: string;
  description: string;
  version: string;
  active: boolean;
  mdFilename: string;
  docxFilename: string;
}

export const STARTERS: Starter[] = [
  {
    slug: 'msa',
    label: 'Master Services Agreement',
    description: 'Standalone MSA — framework agreement covering legal protections without an attached SOW.',
    version: 'v2',
    active: true,
    mdFilename: 'msa.md',
    docxFilename: 'msa.docx',
  },
  {
    slug: 'msa-sow',
    label: 'MSA + SOW-01 (New Client)',
    description: 'New client — full MSA + SOW merged, all 6 legal protections.',
    version: 'v2',
    active: true,
    mdFilename: 'msa-sow.md',
    docxFilename: 'Softway_MSA_Template.docx',
  },
  {
    slug: 'sow-standalone',
    label: 'Standalone SOW (Repeat Client)',
    description: 'Repeat client with existing MSA on file.',
    version: 'v2',
    active: true,
    mdFilename: 'sow-standalone.md',
    docxFilename: 'sow-standalone.docx',
  },
  {
    slug: 'change-order',
    label: 'Change Order',
    description: 'Scope or pricing update to an existing SOW.',
    version: 'v2',
    active: true,
    mdFilename: 'change-order.md',
    docxFilename: 'change-order.docx',
  },
];

export function getStarter(slug: string): Starter | undefined {
  return STARTERS.find((s) => s.slug === slug);
}

export function getStarterMdPath(starter: Starter): string {
  return path.resolve(__dirname, '../../starter-templates', starter.mdFilename);
}

export function getStarterDocxPath(starter: Starter): string {
  return path.resolve(__dirname, '../../starter-templates', starter.docxFilename);
}

export function getRequiredFieldKeys(contractType: string): string[] {
  return getRequiredKeys(contractType);
}

export function getFieldsForType(contractType: string) {
  return getAllFieldsForType(contractType);
}
