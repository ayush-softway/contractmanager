// Manual smoke test for services/extract.ts.
//
// Run from packages/backend with:
//   npx tsx test_extract.mjs <path-to-pdf-or-docx>
//
// Confirms:
//   1. The dynamic createRequire of pdf-parse works under tsx/ESM.
//   2. mammoth's DOCX path returns text.
//   3. Our normalize() trims whitespace as expected.
//
// Safe to delete — this is not part of the build.

import { extractTextFromBuffer, isSupportedMime } from './src/services/extract.ts';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('usage: npx tsx test_extract.mjs <file.pdf|file.docx>');
  process.exit(1);
}

const ext = extname(filePath).toLowerCase();
const mime =
  ext === '.pdf'
    ? 'application/pdf'
    : ext === '.docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'text/plain';

if (!isSupportedMime(mime)) {
  console.error('unsupported mime:', mime);
  process.exit(1);
}

const buf = readFileSync(filePath);
const text = await extractTextFromBuffer(buf, mime);
console.log(`extracted ${text.length} chars from ${filePath}`);
console.log('---');
console.log(text.slice(0, 500));
