import { mutation, query, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { maybeEncryptValue } from '../lib/encryption';

// Generate a temporary access key for secure viewing
// Uses crypto.getRandomValues for cryptographically secure random bytes
function generateAccessKey(): { key: string; expiresAt: number } {
  // Generate random hex string (32 characters = 16 bytes)
  const array = new Uint8Array(16);
  crypto.getRandomValues(array); // Use Web Crypto API for secure randomness
  const key = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
  return { key, expiresAt };
}

// Public mutation: upload vault document (W-2, 1099, ID, SSN)
export const uploadVaultFile = mutation({
  args: {
    returnId: v.string(),
    taxpayerId: v.string(),
    filename: v.string(),
    mimeType: v.string(),
    dataBase64: v.string(),
    documentType: v.string(),
    associatedTaxpayer: v.optional(v.string()),
  },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    const now = Date.now();
    
    // Generate temporary access key for secure viewing
    const { key: accessKey, expiresAt } = generateAccessKey();
    
    // Determine document category based on type
    let documentCategory = 'supporting';
    if (['W2', '1099-MISC', '1099-NEC', '1099-DIV', '1099-INT', '1099-K'].includes(args.documentType)) {
      documentCategory = 'income';
    } else if (['ID', 'SSN'].includes(args.documentType)) {
      documentCategory = 'identity';
    }
    
    // Store file with vault metadata
    // Mark as sensitive (encrypt) for ID and SSN documents
    const isSensitive = ['ID', 'SSN'].includes(args.documentType);
    const storedData = isSensitive ? maybeEncryptValue(args.dataBase64) : args.dataBase64;
    
    const fileDoc = await db.insert('files', {
      returnId: args.returnId,
      taxpayerId: args.taxpayerId,
      filename: args.filename,
      mimeType: args.mimeType,
      dataBase64: storedData,
      documentType: args.documentType,
      documentCategory,
      associatedTaxpayer: args.associatedTaxpayer || 'primary',
      accessKey,
      accessKeyExpiresAt: expiresAt,
      metadata: {
        uploadedBy: user.subject,
        sensitive: isSensitive,
      },
      createdAt: now,
    });
    
    // Audit trail
    await db.insert('audit', {
      returnId: args.returnId,
      action: 'vault:upload',
      userId: user.subject,
      actor: user.subject,
      triggerSource: 'manual',
      previousValue: null,
      newValue: { 
        fileId: fileDoc._id, 
        filename: args.filename,
        documentType: args.documentType,
        associatedTaxpayer: args.associatedTaxpayer,
      },
      createdAt: now,
    });
    
    return { success: true, fileId: fileDoc._id };
  }
});

// Get file by ID (with access key validation for secure viewing)
export const getVaultFile = query({
  args: { fileId: v.string(), accessKey: v.optional(v.string()) },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    
    try {
      const file = await db.get(args.fileId as any);
      if (!file) throw new Error('File not found');
      
      // Validate access key if provided (for secure viewing)
      if (args.accessKey && file.accessKey !== args.accessKey) {
        throw new Error('Invalid access key');
      }
      
      // Check if access key has expired
      if (file.accessKeyExpiresAt && Date.now() > file.accessKeyExpiresAt) {
        throw new Error('Access key expired');
      }
      
      return file;
    } catch (e) {
      throw new Error('Access denied');
    }
  }
});

// Generate new access key for viewing a file
export const generateFileAccessKey = mutation({
  args: { fileId: v.string() },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    
    const { key: accessKey, expiresAt } = generateAccessKey();
    
    try {
      await db.patch(args.fileId as any, {
        accessKey,
        accessKeyExpiresAt: expiresAt,
      });
    } catch (err) {
      // Log error for debugging
      console.error('Failed to patch file with new access key:', err);
      // Try to find file by ID from full collection scan as fallback
      const files = await db.query('files').collect();
      const file = files.find((f: any) => f._id === args.fileId);
      if (file) {
        await db.patch(file._id, {
          accessKey,
          accessKeyExpiresAt: expiresAt,
        });
      } else {
        throw new Error(`File not found: ${args.fileId}`);
      }
    }
    
    return { accessKey, expiresAt };
  }
});

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
