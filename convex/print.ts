import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { generatePDF } from '../lib/printEngine';
import templates from '../lib/printTemplates';
import { internal } from './_generated/api';

export const generateReturnPDF = mutation({
  args: { returnId: v.string(), template: v.any(), watermark: v.optional(v.boolean()), filename: v.optional(v.string()) },
  handler: async (ctx: any, args: any) => {
    const { db, auth } = ctx;
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    const { returnId, template, watermark = false, filename = 'package.pdf' } = args as any;
    // load return and fields
    const returnDoc = await db.query('returns').withIndex('byReturnId', (q: any) => q.eq('returnId', returnId)).first();
    if (!returnDoc) throw new Error('Return not found');

    const fields = await db.query('fields').withIndex('byReturnId', (q: any) => q.eq('returnId', returnId)).collect();

    const out = await generatePDF({ returnDoc, fields, template, watermark, filename });

    // Prefer storage-backed persistence via internal mutation
    let fileId = null;
    try {
      if (typeof ctx.runMutation === 'function') {
        const res = await ctx.runMutation((internal as any).files.storeGeneratedFile, {
          returnId,
          filename,
          mimeType: 'application/pdf',
          dataBase64: out.base64,
          metadata: { template: (template as any).form, watermark, generatedBy: user.subject },
        });
        fileId = res?.fileId || null;
      }
    } catch (e) {
      // fall through to direct insert
    }
    if (!fileId) {
      const now = Date.now();
      fileId = await db.insert('files', {
        returnId,
        filename,
        mimeType: 'application/pdf',
        dataBase64: out.base64,
        metadata: { template: (template as any).form, watermark, generatedBy: user.subject },
        createdAt: now,
      });
    }
    return { fileId, report: out.report };
  }
});

// Async variant: enqueue heavy PDF generation to an internal Action (Node runtime).
export const generateReturnPDFAsync = mutation({
  args: { returnId: v.string(), template: v.any(), watermark: v.optional(v.boolean()), filename: v.optional(v.string()) },
  handler: async (ctx: any, args: any) => {
    const { db, auth, runAction } = ctx;
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    const { returnId, template, watermark = false, filename = 'package.pdf' } = args;

    // Load return and fields in the transaction, then pass to the action.
    const returnDoc = await db.query('returns').withIndex('byReturnId', (q: any) => q.eq('returnId', returnId)).first();
    if (!returnDoc) throw new Error('Return not found');
    const fields = await db.query('fields').withIndex('byReturnId', (q: any) => q.eq('returnId', returnId)).collect();

    // Prefer storage-backed persistence via internal mutation
    let fileId = null;
    const out = await generatePDF({ returnDoc, fields, template, watermark, filename });
    try {
      if (typeof ctx.runMutation === 'function') {
        const res = await ctx.runMutation((internal as any).files.storeGeneratedFile, {
          returnId,
          filename,
          mimeType: 'application/pdf',
          dataBase64: out.base64,
          metadata: { template: (template as any).form, watermark, generatedBy: user.subject },
        });
        fileId = res?.fileId || null;
      }
    } catch (e) {
      // fall through to direct insert
    }
    if (!fileId) {
      const now = Date.now();
      fileId = await db.insert('files', {
        returnId,
        filename,
        mimeType: 'application/pdf',
        dataBase64: out.base64,
        metadata: { template: (template as any).form, watermark, generatedBy: user.subject },
        createdAt: now,
      });
    }
    return { queued: false, fileId };
  }
});

export const generateReturnPackage = mutation({
  args: { returnId: v.string(), includeInvoice: v.optional(v.boolean()) },
  handler: async (ctx: any, args: any) => {
    const { db, auth } = ctx;
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    const { returnId, includeInvoice = true } = args as any;
    const returnDoc = await db.query('returns').withIndex('byReturnId', (q: any) => q.eq('returnId', returnId)).first();
    if (!returnDoc) throw new Error('Return not found');
    const fields = await db.query('fields').withIndex('byReturnId', (q: any) => q.eq('returnId', returnId)).collect();

    const results: any[] = [];

    // Government copy (clean)
    const gov = await generatePDF({ returnDoc, fields, template: templates.F1040_2025_Page1, watermark: false, filename: `1040_gov_${returnId}.pdf` });
    try {
      const now = Date.now();
      const govDoc = await db.insert('files', { returnId, filename: `1040_gov_${returnId}.pdf`, mimeType: 'application/pdf+json', dataBase64: gov.base64, metadata: { type: 'government', generatedBy: user.subject }, createdAt: now });
      results.push({ role: 'government', fileId: govDoc });
    } catch (e) {
      const now = Date.now();
      const govDoc = await db.insert('files', { returnId, filename: `1040_gov_${returnId}.pdf`, mimeType: 'application/pdf+json', dataBase64: gov.base64, metadata: { type: 'government', generatedBy: user.subject }, createdAt: now });
      results.push({ role: 'government', fileId: govDoc });
    }

    // Client copy (watermarked)
    const client = await generatePDF({ returnDoc, fields, template: templates.F1040_2025_Page1, watermark: true, filename: `1040_client_${returnId}.pdf` });
    try {
      const clientDoc = await db.insert('files', { returnId, filename: `1040_client_${returnId}.pdf`, mimeType: 'application/pdf', dataBase64: client.base64, metadata: { type: 'client', generatedBy: user.subject }, createdAt: Date.now() });
      results.push({ role: 'client', fileId: clientDoc });
    } catch (e) {
      const clientDoc = await db.insert('files', { returnId, filename: `1040_client_${returnId}.pdf`, mimeType: 'application/pdf', dataBase64: client.base64, metadata: { type: 'client', generatedBy: user.subject }, createdAt: Date.now() });
      results.push({ role: 'client', fileId: clientDoc });
    }

    // Invoice / Cover Letter
    if (includeInvoice) {
      // prepare a small payload mapping taxPreparationFee from returnDoc
      const invoiceTemplate = templates.InvoiceTemplate;
      const invoice = await generatePDF({ returnDoc: { ...returnDoc, taxPreparationFee: (returnDoc as any).taxPreparationFee, preparedDate: new Date().toLocaleDateString() }, fields, template: invoiceTemplate, watermark: false, filename: `invoice_${returnId}.pdf` });
      try {
        const invoiceDoc = await db.insert('files', { returnId, filename: `invoice_${returnId}.pdf`, mimeType: 'application/pdf', dataBase64: invoice.base64, metadata: { type: 'invoice', generatedBy: user.subject }, createdAt: Date.now() });
        results.push({ role: 'invoice', fileId: invoiceDoc });
      } catch (e) {
        const invoiceDoc = await db.insert('files', { returnId, filename: `invoice_${returnId}.pdf`, mimeType: 'application/pdf', dataBase64: invoice.base64, metadata: { type: 'invoice', generatedBy: user.subject }, createdAt: Date.now() });
        results.push({ role: 'invoice', fileId: invoiceDoc });
      }
    }

    return { files: results };
  }
});

export const listFilesForReturn = query({
  args: { returnId: v.string() },
  handler: async ({ db }, args) => {
    return await db.query('files').withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId)).collect();
  }
});
