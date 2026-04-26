// Softway ContractGen V2 — Starter Templates (Layer 1: Locked Content)
//
// These templates were converted from .md → .docx via pandoc.
// Legal has approved the content. Nobody edits the source templates.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface Starter {
  slug: string;
  label: string;
  description: string;
  version: string;
  active: boolean;
  filename: string;
}

export const STARTERS: Starter[] = [
  {
    slug: 'msa-sow',
    label: 'MSA + SOW-01 (New Client)',
    description: 'New client — full MSA + SOW merged, all 6 legal protections.',
    version: 'v2',
    active: true,
    filename: 'msa-sow.docx',
  },
  {
    slug: 'sow-standalone',
    label: 'Standalone SOW (Repeat Client)',
    description: 'Repeat client with existing MSA on file.',
    version: 'v2',
    active: true,
    filename: 'sow-standalone.docx',
  },
  {
    slug: 'change-order',
    label: 'Change Order',
    description: 'Scope or pricing update to an existing SOW.',
    version: 'v2',
    active: true,
    filename: 'change-order.docx',
  },
];

export function getStarter(slug: string): Starter | undefined {
  return STARTERS.find((s) => s.slug === slug);
}

export function getStarterFilePath(starter: Starter): string {
  return path.resolve(__dirname, '../../starter-templates', starter.filename);
}
