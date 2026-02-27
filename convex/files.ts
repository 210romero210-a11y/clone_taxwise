import { mutation, query, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { maybeEncryptValue } from '../lib/encryption';

// Public mutation: upload attachments from client. For large files prefer
// using storage-backed uploads via the internal `storeGeneratedFile` mutation
// which will attempt to write to Convex storage when available.
export const uploadAttachment = mutation({
  args: { returnId: v.string(), filename: v.string(), mimeType: v.string(), dataBase64: v.string(), metadata: v.optional(v.any()) },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    const now = Date.now();
    const { returnId, filename, mimeType, dataBase64, metadata } = args as any;
    // If metadata.sensitive is true, encrypt the binary payload before storing
    const storedData = metadata && metadata.sensitive ? maybeEncryptValue(dataBase64) : dataBase64;
    const fileDoc = await db.insert('files', { returnId, filename, mimeType, dataBase64: storedData, metadata: { ...metadata, uploadedBy: user.subject }, createdAt: now });
    await db.insert('audit', { returnId, action: 'file:upload', userId: user.subject, actor: user.subject, previousValue: null, newValue: { fileId: fileDoc._id, filename }, createdAt: now });
    return { fileId: fileDoc._id };
  }
});

export const listFilesForReturn = query({
  args: { returnId: v.string() },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    return await db.query('files').withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId)).collect();
  }
});

// Internal mutation used by Actions or internal workers to persist generated
// files. This will attempt to store the binary in Convex storage when the
// runtime provides a storage writer; otherwise it falls back to in-table base64.
export const storeGeneratedFile = internalMutation({
  args: {
    returnId: v.optional(v.string()),
    filename: v.string(),
    mimeType: v.string(),
    dataBase64: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx: any, args: any) => {
    const { returnId, filename, mimeType, dataBase64, metadata } = args;
    const now = Date.now();

    // Try to use Convex storage if available on the context. We attempt a
    // few plausible method names (put/write/upload) to remain compatible
    // across environments; failures fall back to base64-in-table storage.
    const storage = (ctx as any).storage;
    let storageId: any = null;
    if (storage) {
      const buffer = Buffer.from(dataBase64, 'base64');
      try {
        if (typeof storage.put === 'function') {
          storageId = await storage.put(filename, buffer, { contentType: mimeType });
        } else if (typeof storage.write === 'function') {
          storageId = await storage.write(filename, buffer, { contentType: mimeType });
        } else if (typeof storage.upload === 'function') {
          storageId = await storage.upload(filename, buffer, { contentType: mimeType });
        }
      } catch (e) {
        // fall back to in-table storage if storage write fails
        // eslint-disable-next-line no-console
        console.warn('Convex storage write failed, falling back to table storage', e);
        storageId = null;
      }
    }

    if (storageId) {
      const fileDoc = await ctx.db.insert('files', { returnId, filename, mimeType, storageId, metadata: { ...metadata }, createdAt: now });
      await ctx.db.insert('audit', { returnId, action: 'file:store', userId: null, actor: 'system', previousValue: null, newValue: { fileId: fileDoc._id, storageId }, createdAt: now });
      return { fileId: fileDoc._id, storageId };
    }

    // fallback: store base64 payload in table
    const storedData = metadata && metadata.sensitive ? maybeEncryptValue(dataBase64) : dataBase64;
    const fileDoc = await ctx.db.insert('files', { returnId, filename, mimeType, dataBase64: storedData, metadata: { ...metadata }, createdAt: now });
    await ctx.db.insert('audit', { returnId, action: 'file:store', userId: null, actor: 'system', previousValue: null, newValue: { fileId: fileDoc._id }, createdAt: now });
    return { fileId: fileDoc._id };
  }
});
