"use node";
import { internalAction } from './_generated/server';
import { generatePDF } from '../lib/printEngine';
import { internal } from './_generated/api';

// Internal Node action to perform heavy PDF generation off the main mutation
// thread. It generates the PDF and delegates storage to the internal
// `storeGeneratedFile` mutation so storage/backups are handled consistently.
export const generateReturnPDFAction = internalAction({
  handler: async (ctx: any, args: any) => {
    const { returnDoc, fields, template, watermark = false, filename = 'package.pdf', userId } = args;
    try {
      const out = await generatePDF({ returnDoc, fields, template, watermark, filename });

      // Prefer to call the internal mutation which will attempt to write to
      // Convex storage and fall back to in-table base64 storage.
      try {
        if (typeof ctx.runMutation === 'function') {
          const res = await ctx.runMutation((internal as any).files.storeGeneratedFile, {
            returnId: returnDoc?.returnId || null,
            filename,
            mimeType: 'application/pdf',
            dataBase64: out.base64,
            metadata: { template: (template as any)?.form, watermark, generatedBy: userId },
          });
          return res;
        }
      } catch (e) {
        // best-effort; fall through to direct insert
        // eslint-disable-next-line no-console
        console.warn('runMutation(storeGeneratedFile) failed in action, falling back to direct insert', e);
      }

      // Fallback: insert directly into files table
      const now = Date.now();
      const fileDoc = await ctx.db.insert('files', {
        returnId: returnDoc?.returnId || null,
        filename,
        mimeType: 'application/pdf',
        dataBase64: out.base64,
        metadata: { template: (template as any)?.form, watermark, generatedBy: userId },
        createdAt: now,
      });
      return { fileId: fileDoc };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('generateReturnPDFAction error', err);
      throw err;
    }
  }
});
"use node";
import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { generatePDF } from '../lib/printEngine';
import { internal } from './_generated/api';

// Action: generate PDF in Node runtime (can be CPU/memory heavy). The action
// receives pre-fetched `returnDoc` and `fields` to avoid doing DB work inside
// the action. After generating the PDF it delegates persistence to an
// internal mutation which will store to Convex storage when available.
export const generateReturnPDFAction = internalAction({
  args: {
    returnDoc: v.any(),
    fields: v.array(v.any()),
    template: v.any(),
    watermark: v.optional(v.boolean()),
    filename: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const { returnDoc, fields, template, watermark = false, filename = 'package.pdf', userId } = args;

    // Generate PDF bytes using the shared print engine
    const out = await generatePDF({ returnDoc, fields, template, watermark, filename });

    // Persist the generated file using the internal mutation which will try
    // to use Convex storage where available.
    try {
      await ctx.runMutation(internal.files.storeGeneratedFile, {
        returnId: returnDoc?.returnId ?? null,
        filename: out.report.filename || filename,
        mimeType: 'application/pdf',
        dataBase64: out.base64,
        metadata: { template: template?.form, watermark, generatedBy: userId },
      });
    } catch (e) {
      // Log and swallow — action should be resilient; diagnostics/audit will
      // capture failures elsewhere if needed.
      // eslint-disable-next-line no-console
      console.error('Failed to persist generated PDF', e);
    }

    return { ok: true };
  },
});
