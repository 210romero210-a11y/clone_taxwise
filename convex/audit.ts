/**
 * Audit Trail Functions for IRS Publication 1345 Compliance
 * 
 * Provides comprehensive audit logging with:
 * - Hash chain for tamper evidence
 * - Multiple trigger sources
 * - 7-year retention support
 * - Date range filtering
 */
import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { maybeEncryptValue } from '../lib/encryption';
import { 
  hashEntry, 
  verifyChain, 
  getLatestHash, 
  GENESIS_HASH,
  shouldArchiveEntry,
  TriggerSource,
  AUDIT_ACTIONS 
} from '../lib/audit/hashChain';

/**
 * List audit entries for a return with optional filtering
 */
export const listAuditForReturn = query({
  args: { 
    returnId: v.string(),
    actionFilter: v.optional(v.string()),
    userIdFilter: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    
    // Use indexed query on returnId first to minimize data fetched
    let query = db.query('audit').withIndex('byReturnId', (q: any) => 
      q.eq('returnId', args.returnId)
    );
    
    // Apply simple filters at query level where possible
    // For complex filters (action, userId, date range), apply in memory
    let entries = await query.collect();
    
    // Apply action filter if provided
    if (args.actionFilter) {
      entries = entries.filter(e => e.action === args.actionFilter);
    }
    
    // Apply userId filter if provided
    if (args.userIdFilter) {
      entries = entries.filter(e => e.userId === args.userIdFilter);
    }
    
    // Apply date range filters
    if (args.startDate !== undefined) {
      entries = entries.filter(e => e.createdAt && e.createdAt >= args.startDate!);
    }
    
    if (args.endDate !== undefined) {
      entries = entries.filter(e => e.createdAt && e.createdAt <= args.endDate!);
    }
    
    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    // Apply limit
    if (args.limit) {
      entries = entries.slice(0, args.limit);
    }
    
    return entries;
  }
});

/**
 * Get audit entries by action type
 */
export const listAuditByAction = query({
  args: { 
    action: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    
    let entries = await db.query('audit')
      .withIndex('byAction', (q: any) => q.eq('action', args.action))
      .collect();
    
    // Sort by timestamp descending
    entries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    // Apply limit
    if (args.limit) {
      entries = entries.slice(0, args.limit);
    }
    
    return entries;
  }
});

/**
 * Get audit entries by date range (for IRS production requests)
 */
export const listAuditByDateRange = query({
  args: { 
    startDate: v.number(),
    endDate: v.number(),
    returnId: v.optional(v.string()),
  },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    
    let entries = await db.query('audit')
      .withIndex('byCreatedAt', (q: any) => 
        q.gte('createdAt', args.startDate).lte('createdAt', args.endDate)
      )
      .collect();
    
    // Filter by returnId if provided
    if (args.returnId) {
      entries = entries.filter(e => e.returnId === args.returnId);
    }
    
    // Sort by timestamp
    entries.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    
    return entries;
  }
});

/**
 * Log an audit event with hash chain support
 * This is the main mutation for creating audit entries
 */
export const logAuditEvent = mutation({
  args: {
    returnId: v.optional(v.string()),
    formId: v.optional(v.string()),
    fieldId: v.optional(v.string()),
    userId: v.optional(v.string()),
    actor: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    action: v.string(),
    triggerSource: v.optional(v.string()), // "manual" | "ai_extraction" | "import" | "calculation" | "filing"
    previousValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
  },
  handler: async ({ db }, args) => {
    const timestamp = Date.now();
    
    // Get the latest hash from existing entries for this return
    let previousHash: string | null = null;
    
    if (args.returnId) {
      const existingEntries = await db.query('audit')
        .withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId!))
        .collect();
      
      if (existingEntries.length > 0) {
        // Sort by timestamp and get the latest
        existingEntries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        previousHash = existingEntries[0]?.hashChainEntry || null;
      }
    } else {
      // For entries without returnId, get any existing entries
      const allEntries = await db.query('audit').collect();
      if (allEntries.length > 0) {
        allEntries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        previousHash = allEntries[0]?.hashChainEntry || null;
      }
    }
    
    // Compute hash for this entry
    const hashChainEntry = await hashEntry(previousHash, {
      returnId: args.returnId,
      formId: args.formId,
      fieldId: args.fieldId,
      userId: args.userId,
      action: args.action,
      timestamp,
    });
    
    // Encrypt PII values
    const storedPreviousValue = args.previousValue ? maybeEncryptValue(args.previousValue) : undefined;
    const storedNewValue = args.newValue ? maybeEncryptValue(args.newValue) : undefined;
    
    // Insert audit entry
    const entryId = await db.insert('audit', {
      returnId: args.returnId,
      formId: args.formId,
      fieldId: args.fieldId,
      userId: args.userId,
      actor: args.actor,
      sessionId: args.sessionId,
      ipAddress: args.ipAddress,
      action: args.action,
      triggerSource: args.triggerSource,
      hashChainEntry,
      previousValue: storedPreviousValue,
      newValue: storedNewValue,
      createdAt: timestamp,
    });
    
    return { success: true, entryId, hashChainEntry };
  }
});

/**
 * Verify the hash chain integrity for a return
 * Returns verification result with details
 */
export const verifyHashChain = query({
  args: { 
    returnId: v.string(),
  },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    
    // Get all entries for this return
    const entries = await db.query('audit')
      .withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId))
      .collect();
    
    if (entries.length === 0) {
      return { valid: true, message: 'No entries to verify', entryCount: 0 };
    }
    
    // Use the hash chain verification function
    const result = await verifyChain(entries);
    
    return {
      valid: result.valid,
      message: result.message,
      entryCount: entries.length,
      invalidIndex: result.invalidIndex,
    };
  }
});

/**
 * Get audit chain status - checks if chain is intact
 */
export const getAuditChainStatus = query({
  args: { 
    returnId: v.string(),
  },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    
    const entries = await db.query('audit')
      .withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId))
      .collect();
    
    if (entries.length === 0) {
      return { 
        hasEntries: false, 
        isIntact: true, 
        entryCount: 0,
        firstEntryTime: null,
        latestEntryTime: null,
      };
    }
    
    // Sort by timestamp
    entries.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    
    // Check if all hashes are present
    const allHaveHashes = entries.every(e => !!e.hashChainEntry);
    
    // Verify chain
    const verification = await verifyChain(entries);
    
    return {
      hasEntries: true,
      isIntact: verification.valid && allHaveHashes,
      entryCount: entries.length,
      firstEntryTime: entries[0]?.createdAt,
      latestEntryTime: entries[entries.length - 1]?.createdAt,
      needsRehash: !allHaveHashes,
    };
  }
});

/**
 * Get entries that should be archived (older than 7 years)
 * IRS Publication 1345 requires 7-year retention
 */
export const getEntriesForArchival = query({
  args: {},
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    
    const sevenYearsAgo = Date.now() - (7 * 365 * 24 * 60 * 60 * 1000);
    
    const entries = await db.query('audit')
      .withIndex('byCreatedAt', (q: any) => q.lt('createdAt', sevenYearsAgo))
      .collect();
    
    return entries;
  }
});

// Export audit action constants for use in other modules
export { AUDIT_ACTIONS };
export type { TriggerSource };
