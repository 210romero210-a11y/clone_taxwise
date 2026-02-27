// Simple MeF (Modernized e-File) XML exporter stub.
// This is intentionally lightweight: it creates a basic XML envelope with
// taxpayer identifiers and a few common fields. A production implementation
// would follow the official IRS MeF XSDs and validate thoroughly.

export function generateMeFXML(returnDoc: any, fields: any[]) {
  const taxpayer = returnDoc.taxpayerId || '';
  const year = returnDoc.year || '';

  const fieldsXml = (fields || [])
    .map((f: any) => {
      const id = `${f.formId}.${f.fieldId}`;
      const value = f.value === undefined || f.value === null ? '' : String(f.value);
      return `<Field id="${escapeXml(id)}">${escapeXml(value)}</Field>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<MeFReturn year="${escapeXml(String(year))}">\n  <Taxpayer>${escapeXml(String(taxpayer))}</Taxpayer>\n  <Fields>\n${fieldsXml}\n  </Fields>\n</MeFReturn>`;

  return xml;
}

function escapeXml(s: string) {
  return s.replace(/[<>&'\"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c] as string));
}

export default { generateMeFXML };
