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
