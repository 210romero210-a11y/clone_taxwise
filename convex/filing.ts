/**
 * MeF Filing Mutations
 * Convex functions for IRS electronic filing management
 * Based on IRS Publication 4163 and 4164
 */

import { internalMutation, internalQuery, query } from './_generated/server';
import { v } from 'convex/values';
import { Collections } from './schema';

/**
 * Generate a unique filing ID
 */
function generateFilingId(): string {
  return `FIL${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Generate a unique submission ID
 */
function generateSubmissionId(): string {
  return `SUB${Date.now().toString(36).toUpperCase()}`;
}

// ============================================================================
// Internal Functions
// ============================================================================

/**
 * Internal function to create a new filing record
 */
export const createFilingRecord = internalMutation({
  args: {
    returnId: v.string(),
    taxYear: v.number(),
    testMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const filingId = generateFilingId();
    const submissionId = generateSubmissionId();

    const filing = {
      filingId,
      returnId: args.returnId,
      submissionId,
      taxYear: args.taxYear,
      status: 'pending',
      testMode: args.testMode || false,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const filingDocId = await ctx.db.insert('filings', filing);
    return { filingId, submissionId, filingDocId };
  },
});

/**
 * Internal function to update filing status
 */
export const updateFilingStatus = internalMutation({
  args: {
    filingId: v.string(),
    status: v.string(),
    acknowledgmentNumber: v.optional(v.string()),
    irsMessage: v.optional(v.string()),
    errors: v.optional(v.any()),
    xmlPayload: v.optional(v.string()),
    xmlResponse: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { filingId, ...updates } = args;
    
    // Find the filing by filingId
    const existingFilings = await ctx.db
      .query('filings')
      .withIndex('byFilingId', (q) => q.eq('filingId', filingId))
      .collect();

    if (existingFilings.length === 0) {
      throw new Error(`Filing not found: ${filingId}`);
    }

    const filing = existingFilings[0];
    
    await ctx.db.patch(filing._id, {
      ...updates,
      statusChangedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal function to get filing by ID
 */
export const getFilingByFilingId = internalQuery({
  args: {
    filingId: v.string(),
  },
  handler: async (ctx, args) => {
    const filings = await ctx.db
      .query('filings')
      .withIndex('byFilingId', (q) => q.eq('filingId', args.filingId))
      .collect();

    return filings[0] || null;
  },
});

/**
 * Internal function to get all filings for a return
 */
export const getFilingsByReturnId = internalQuery({
  args: {
    returnId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('filings')
      .withIndex('byReturnId', (q) => q.eq('returnId', args.returnId))
      .collect();
  },
});

// ============================================================================
// Public Queries
// ============================================================================

/**
 * Get filing history for the current user's returns
 */
export const getFilingHistory = query({
  args: {
    returnId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let filings;
    
    if (args.returnId) {
      filings = await ctx.db
        .query('filings')
        .withIndex('byReturnId', (q) => q.eq('returnId', args.returnId!))
        .order('desc')
        .take(args.limit || 50);
    } else {
      // Get all recent filings
      filings = await ctx.db
        .query('filings')
        .order('desc')
        .take(args.limit || 50);
    }

    return filings;
  },
});

/**
 * Get a specific filing by ID
 */
export const getFiling = query({
  args: {
    filingId: v.string(),
  },
  handler: async (ctx, args) => {
    const filings = await ctx.db
      .query('filings')
      .withIndex('byFilingId', (q) => q.eq('filingId', args.filingId))
      .collect();

    return filings[0] || null;
  },
});

/**
 * Get filing status for a return
 */
export const getFilingStatus = query({
  args: {
    returnId: v.string(),
  },
  handler: async (ctx, args) => {
    const filings = await ctx.db
      .query('filings')
      .withIndex('byReturnId', (q) => q.eq('returnId', args.returnId))
      .order('desc')
      .take(1);

    if (filings.length === 0) {
      return { hasFiling: false };
    }

    const latestFiling = filings[0];
    return {
      hasFiling: true,
      filingId: latestFiling.filingId,
      status: latestFiling.status,
      submittedAt: latestFiling.submittedAt,
      acknowledgmentNumber: latestFiling.acknowledgmentNumber,
    };
  },
});

// ============================================================================
// Public Mutations
// ============================================================================

/**
 * Prepare a return for filing - validates and creates filing record
 */
export const prepareFiling = internalMutation({
  args: {
    returnId: v.string(),
    taxYear: v.number(),
    testMode: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Check if return exists
    const returnDoc = await ctx.db
      .query('returns')
      .withIndex('byReturnId', (q) => q.eq('returnId', args.returnId))
      .first();

    if (!returnDoc) {
      throw new Error(`Return not found: ${args.returnId}`);
    }

    // Check if return is locked (already filed)
    if (returnDoc.isLocked) {
      throw new Error('Return is locked and cannot be modified');
    }

    // Create filing record
    const filingId = generateFilingId();
    const submissionId = generateSubmissionId();
    const now = Date.now();

    const filing = {
      filingId,
      returnId: args.returnId,
      submissionId,
      taxYear: args.taxYear,
      status: 'prepared',
      testMode: args.testMode || false,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const filingDocId = await ctx.db.insert('filings', filing);

    return {
      filingId,
      submissionId,
      filingDocId,
      status: 'prepared',
    };
  },
});

/**
 * Update filing status after transmission
 */
export const recordFilingTransmission = internalMutation({
  args: {
    filingId: v.string(),
    status: v.union(
      v.literal('transmitted'),
      v.literal('accepted'),
      v.literal('rejected'),
      v.literal('error')
    ),
    acknowledgmentNumber: v.optional(v.string()),
    irsMessage: v.optional(v.string()),
    errors: v.optional(v.any()),
    xmlResponse: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { filingId, ...updates } = args;

    // Find the filing
    const filings = await ctx.db
      .query('filings')
      .withIndex('byFilingId', (q) => q.eq('filingId', filingId))
      .collect();

    if (filings.length === 0) {
      throw new Error(`Filing not found: ${filingId}`);
    }

    const filing = filings[0];
    const now = Date.now();

    // Update the filing
    await ctx.db.patch(filing._id, {
      ...updates,
      statusChangedAt: now,
      updatedAt: now,
      submittedAt: updates.status === 'transmitted' ? now : filing.submittedAt,
    });

    // If accepted, lock the return
    if (updates.status === 'accepted') {
      const returnDocs = await ctx.db
        .query('returns')
        .withIndex('byReturnId', (q) => q.eq('returnId', filing.returnId))
        .collect();

      if (returnDocs.length > 0) {
        await ctx.db.patch(returnDocs[0]._id, {
          isLocked: true,
          lockedAt: now,
        });
      }
    }

    return { success: true };
  },
});

/**
 * Retry a failed filing
 */
export const retryFiling = internalMutation({
  args: {
    filingId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the filing
    const filings = await ctx.db
      .query('filings')
      .withIndex('byFilingId', (q) => q.eq('filingId', args.filingId))
      .collect();

    if (filings.length === 0) {
      throw new Error(`Filing not found: ${args.filingId}`);
    }

    const filing = filings[0];

    // Can only retry rejected or error filings
    if (filing.status !== 'rejected' && filing.status !== 'error') {
      throw new Error(`Cannot retry filing with status: ${filing.status}`);
    }

    // Check retry count
    const maxRetries = 3;
    if ((filing.retryCount || 0) >= maxRetries) {
      throw new Error('Maximum retry attempts exceeded');
    }

    // Reset status to prepared for retry
    await ctx.db.patch(filing._id, {
      status: 'prepared',
      retryCount: (filing.retryCount || 0) + 1,
      updatedAt: Date.now(),
    });

    return { success: true, retryCount: (filing.retryCount || 0) + 1 };
  },
});

/**
 * Cancel a pending filing
 */
export const cancelFiling = internalMutation({
  args: {
    filingId: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the filing
    const filings = await ctx.db
      .query('filings')
      .withIndex('byFilingId', (q) => q.eq('filingId', args.filingId))
      .collect();

    if (filings.length === 0) {
      throw new Error(`Filing not found: ${args.filingId}`);
    }

    const filing = filings[0];

    // Can only cancel pending or prepared filings
    if (filing.status !== 'pending' && filing.status !== 'prepared') {
      throw new Error(`Cannot cancel filing with status: ${filing.status}`);
    }

    // Update status to cancelled
    await ctx.db.patch(filing._id, {
      status: 'cancelled',
      statusChangedAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export default {
  getFilingHistory,
  getFiling,
  getFilingStatus,
  prepareFiling,
  recordFilingTransmission,
  retryFiling,
  cancelFiling,
};
