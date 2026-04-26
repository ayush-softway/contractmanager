export async function extractDriveFields(text: string) {
  const fields: Record<string, string> = {};
  
  const msaDateMatch = text.match(/MSA\s*Effective\s*Date:\s*(.*)/i);
  if (msaDateMatch?.[1]) fields.msa_effective_date = msaDateMatch[1].trim();

  const endDateMatch = text.match(/Project\s*End\s*Date:\s*(.*)/i);
  if (endDateMatch?.[1]) fields.project_end_date = endDateMatch[1].trim();

  return fields;
}
