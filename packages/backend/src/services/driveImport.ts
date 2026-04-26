// Softway ContractGen V2 — Drive Text Extraction Service
//
// Pattern-matching extraction from pasted text / Google Drive doc content.
// Pulls dates, dollar amounts, workshop counts, attendee counts, and locations.

export function extractDriveFields(text: string): Partial<Record<string, string>> {
  const fields: Partial<Record<string, string>> = {};

  // Date patterns (MM/DD/YYYY)
  const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
  if (dateMatch) fields.event_dates = dateMatch.join(', ');

  // MSA Effective Date
  const msaDateMatch = text.match(/MSA Effective Date:\s*(.+)/i);
  if (msaDateMatch?.[1]) fields.msa_date = msaDateMatch[1].trim();

  // Dollar amounts
  const dollarMatch = text.match(/\$[\d,]+(\.\d{2})?/g);
  if (dollarMatch) fields.project_fee_usd = dollarMatch[0].replace(/[$,]/g, '');

  // Workshop / session count
  const workshopMatch = text.match(/(\d+)\s*(workshops?|sessions?)/i);
  if (workshopMatch) fields.workshop_count = workshopMatch[1];

  // Attendee count
  const attendeeMatch = text.match(/(\d+)\s*(attendees?|participants?|people)/i);
  if (attendeeMatch) fields.attendee_count = attendeeMatch[1];

  // Location
  const locationMatch = text.match(/(?:location|venue|site):\s*(.+)/i);
  if (locationMatch?.[1]) fields.location = locationMatch[1].trim();

  return fields;
}
