import { canonicalDot, parseDotKey } from './fieldIds';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { maybeDecryptValue } from './encryption';
import { Locale, getSpanishFormTitle, formatCurrency as formatCurrencyHelper } from './i18n/translator';

// Flexible mappings use `any` intentionally for speed and to avoid strict
// coupling between form schema and templates.
export type FieldMapping = any;

// Get localized form title based on locale
export function getFormTitle(formId: string, locale: Locale): string {
  if (locale === 'es') {
    return getSpanishFormTitle(formId);
  }
  return formId;
}

export async function generatePDF(options: {
  returnDoc: any;
  fields: any[];
  template: any; // mapping json
  watermark?: boolean;
  filename?: string;
  locale?: Locale;
}) {
  const { returnDoc, fields, template, watermark = false, filename = 'output.pdf', locale = 'en' } = options;

  // Resolve mapped values
  const resolved: any[] = [];
  for (const m of template.mappings || []) {
    let value: any = null;
    if (m.source) {
      try {
        const srcKey = canonicalDot(String(m.source));
        const parsed = parseDotKey(srcKey);
        const f = fields.find((ff) => String(ff.formId) === parsed.formId && String(ff.fieldId) === parsed.fieldId);
        if (f) value = f.value;
      } catch (e) {
        // ignore parse errors
      }
    }

    if ((value === null || value === undefined) && m.field_name) {
      const name = String(m.field_name).toLowerCase();
      const f = fields.find((ff) => {
        const id = `${String(ff.formId)}.${String(ff.fieldId)}`.toLowerCase();
        return id.includes(name) || String(ff.label || '').toLowerCase().includes(name);
      });
      if (f) value = f.value;
      else if (returnDoc && Object.prototype.hasOwnProperty.call(returnDoc, m.field_name)) {
        value = (returnDoc as any)[m.field_name];
      }
    }

    if ((value === null || value === undefined)) {
      const f = fields.find((ff) => ff.fieldId === m.id || `${ff.formId}.${ff.fieldId}` === m.id);
      if (f) value = f.value;
    }

    // Decrypt value if it was stored as encrypted PII
    const plain = maybeDecryptValue(value);
    resolved.push({ ...m, value: plain });
  }

  // Create PDF using pdf-lib
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Try to embed a background PDF if template provides a template_url and the
  // file can be resolved locally (public/) or fetched remotely. Fall back to
  // a blank page if no background is available.
  let pages: any[] = [];
  let pageWidth = template.dimensions?.width || 612;
  let pageHeight = template.dimensions?.height || 792;

  let bgBytes: Uint8Array | null = null;
  if (template.template_url) {
    const urlStr = String(template.template_url || '');
    // local file under public/
    const rel = urlStr.replace(/^\//, '');
    const localPath = path.join(process.cwd(), 'public', rel);
    try {
      if (fs.existsSync(localPath)) {
        bgBytes = fs.readFileSync(localPath);
      } else if (/^https?:\/\//i.test(urlStr) && typeof fetch === 'function') {
        const res = await fetch(urlStr);
        if (res.ok) {
          const ab = await res.arrayBuffer();
          bgBytes = Buffer.from(ab);
        }
      }
    } catch (e) {
      // ignore background loading errors
      bgBytes = null;
    }
  }

  if (bgBytes) {
    try {
      const bgPdf = await PDFDocument.load(bgBytes as Uint8Array);
      const indices = bgPdf.getPageIndices();
      const copied = await pdfDoc.copyPages(bgPdf, indices);
      for (const cp of copied) {
        const newPg = pdfDoc.addPage(cp);
        pages.push(newPg);
      }
      // adopt size from first background page if present
      if (pages.length > 0) {
        pageWidth = pages[0].getWidth();
        pageHeight = pages[0].getHeight();
      }
    } catch (e) {
      // if embedding background fails, create a blank page below
      pages = [];
    }
  }

  // Ensure at least one page exists
  if (pages.length === 0) {
    const pg = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(pg);
  }

  // Optional watermark — draw on every page
  if (watermark) {
    const wm = 'CONFIDENTIAL';
    for (const p of pages) {
      try {
        p.drawText(wm, {
          x: p.getWidth() / 2 - 200,
          y: p.getHeight() / 2,
          size: 72,
          font: helveticaBold,
          color: rgb(0.7, 0.7, 0.7),
          rotate: degrees(-40),
          opacity: 0.18,
        } as any);
      } catch (_) {
        p.drawText(wm, { x: p.getWidth() / 2 - 200, y: p.getHeight() / 2, size: 72, font: helveticaBold, color: rgb(0.7, 0.7, 0.7) });
      }
    }
  }

  // Draw fields grouped by page (support m.page index in mappings)
  for (const m of resolved) {
    const pageIndex = typeof m.page === 'number' ? m.page : 0;
    // if mapping references a page beyond current pages, create blank pages up to that index
    while (pageIndex >= pages.length) {
      const pg = pdfDoc.addPage([pageWidth, pageHeight]);
      pages.push(pg);
    }
    const p = pages[pageIndex];
    const x = (m.coordinates?.x || 0) as number;
    const yTop = (m.coordinates?.y || 0) as number;
    const y = p.getHeight() - yTop; // convert top-left y to PDF bottom-left origin
    const style = m.style || {};
    const fontSize = style.fontSize || (m.type === 'checkbox' ? 12 : 10);
    const color = style.color ? parseColor(style.color) : rgb(0, 0, 0);

    if (m.type === 'checkbox') {
      if (m.value) {
        const mark = m.mark || 'X';
        p.drawText(String(mark), { x, y, size: fontSize, font: helveticaBold, color });
      }
      continue;
    }

    if (m.type === 'currency') {
      const num = Number(m.value) || 0;
      // Use locale-aware currency formatting
      const localeCode = locale === 'es' ? 'es-ES' : 'en-US';
      const text = new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'USD' }).format(num);
      p.drawText(String(text), { x, y, size: fontSize, font: helvetica, color });
      continue;
    }

    // default: text/numeric
    let text = m.value === null || m.value === undefined ? '' : String(m.value);
    if (m.max_length && text.length > m.max_length) text = text.slice(0, m.max_length);
    p.drawText(text, { x, y, size: fontSize, font: helvetica, color });
  }

  const pdfBytes = await pdfDoc.save();
  const base64 = Buffer.from(pdfBytes).toString('base64');

  const report = {
    filename,
    templateUrl: template.template_url,
    watermark: !!watermark,
    generatedAt: Date.now(),
    returnId: returnDoc.returnId,
    locale,
    formTitle: template.form ? getFormTitle(template.form, locale) : undefined,
    pages: pages.map((pg: any, i: number) => ({ template: template.form, width: pg.getWidth(), height: pg.getHeight(), fields: resolved.filter((r: any) => (r.page || 0) === i).map((r: any) => ({ id: r.id, coordinates: r.coordinates, value: r.value, type: r.type })) })),
  };

  return { base64, report };
}

function parseColor(color: string) {
  if (!color) return rgb(0, 0, 0);
  const s = String(color).trim();
  if (s.startsWith('#')) {
    if (s.length === 7) {
      const r = parseInt(s.slice(1, 3), 16) / 255;
      const g = parseInt(s.slice(3, 5), 16) / 255;
      const b = parseInt(s.slice(5, 7), 16) / 255;
      return rgb(r, g, b);
    }
    if (s.length === 4) {
      const r = parseInt(s[1] + s[1], 16) / 255;
      const g = parseInt(s[2] + s[2], 16) / 255;
      const b = parseInt(s[3] + s[3], 16) / 255;
      return rgb(r, g, b);
    }
  }
  if (s.toLowerCase() === 'black') return rgb(0, 0, 0);
  if (s.toLowerCase() === 'white') return rgb(1, 1, 1);
  return rgb(0, 0, 0);
}

export default { generatePDF, getFormTitle };
