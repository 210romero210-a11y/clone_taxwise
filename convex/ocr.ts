/**
 * Convex OCR Actions for AI Document Extraction
 * 
 * This module provides:
 * - OCR scan initiation and processing
 * - Fault tolerance with automatic retries
 * - Rate limiting integration
 * - Audit trail for AI-imported fields
 * 
 * NOTE: Uses direct imports from lib/ which are Convex-compatible
 * (plain async functions, not Convex-registered)
 */

import { action, query } from './_generated/server';
import { v } from 'convex/values';
import { 
  OllamaClient, 
  getOllamaClient, 
  ExtractionResult, 
  DocumentType,
  RateLimitInfo 
} from '../lib/ollamaClient';
import { 
  mapExtractedFields, 
  toFieldUpdates,
  validateExtractedFields,
  getSSNTo1040Mapping
} from '../lib/fieldMapping';
import { maybeDecryptValue } from '../lib/encryption';
import { hashEntry, getLatestHash, AUDIT_ACTIONS } from '../lib/audit/hashChain';

// ============================================
// Types for Internal Context
// ============================================

type InternalCtx = any;

// ============================================
// Helper Functions (Non-Convex, Plain Functions)
// ============================================

/**
 * Get required fields for each document type
 */
function getRequiredFields(documentType: string): string[] {
  switch (documentType) {
    case 'W2':
      return ['1040.totalIncome', 'W2.box1'];
    case '1099':
      return ['SchC.netEarnings', '1099_MISC.box7'];
    case 'ID':
      return ['1040.firstName', '1040.lastName'];
    case 'SSN':
      return ['1040.socialSecurityNumber'];
    default:
      return [];
  }
}

// ============================================
// Internal Functions
// ============================================

async function createScanRecord(
  ctx: InternalCtx,
  args: {
    returnId: string;
    fileId: string;
    userId: string;
    documentType: string;
    status: string;
  }
): Promise<string> {
  const scanDoc = {
    returnId: args.returnId,
    fileId: args.fileId,
    userId: args.userId,
    documentType: args.documentType,
    status: args.status,
    retryCount: 0,
    createdAt: Date.now(),
  };
  
  const scanId = await ctx.db.insert('ocrScans', scanDoc);
  return scanId;
}

async function getFileById(
  ctx: InternalCtx,
  fileId: string
): Promise<any> {
  // Try direct lookup first - Convex IDs can be queried directly
  try {
    const file = await ctx.db.get(fileId as any);
    return file;
  } catch {
    // If direct get fails, file doesn't exist
    return null;
  }
}

async function updateScanRecord(
  ctx: InternalCtx,
  args: {
    scanId: string;
    status: string;
    errorMessage?: string;
    extractedData?: any;
    mappedFields?: any;
    confidence?: number;
    processingTimeMs?: number;
    modelUsed?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { scanId, ...updates } = args;
  
  // Try direct patch first - Convex IDs can be patched directly
  try {
    await ctx.db.patch(scanId as any, {
      ...updates,
      completedAt: updates.status === 'completed' ? Date.now() : undefined,
    });
    return { success: true };
  } catch (e) {
    // Log error but don't fail silently - track it
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`Failed to update scan record ${scanId}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

async function logOcrStart(
  ctx: InternalCtx,
  args: {
    returnId: string;
    userId: string;
    scanId: string;
    documentType: string;
  }
): Promise<void> {
  const timestamp = Date.now();
  
  // Get previous hash
  const existingEntries = await ctx.db.query('audit')
    .withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId))
    .collect();
  const previousHash = await getLatestHash(existingEntries);

  // Compute hash
  const hashChainEntry = await hashEntry(previousHash, {
    returnId: args.returnId,
    userId: args.userId,
    action: AUDIT_ACTIONS.AI_EXTRACT_START,
    timestamp,
  });

  await ctx.db.insert('audit', {
    returnId: args.returnId,
    userId: args.userId,
    action: AUDIT_ACTIONS.AI_EXTRACT_START,
    triggerSource: 'ai_extraction',
    newValue: { 
      scanId: args.scanId, 
      documentType: args.documentType 
    },
    hashChainEntry,
    createdAt: timestamp,
  });
}

async function logOcrComplete(
  ctx: InternalCtx,
  args: {
    returnId: string;
    userId: string;
    scanId: string;
    documentType: string;
    fieldsApplied: number;
    confidence: number;
  }
): Promise<void> {
  const timestamp = Date.now();
  
  const existingEntries = await ctx.db.query('audit')
    .withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId))
    .collect();
  const previousHash = await getLatestHash(existingEntries);

  const hashChainEntry = await hashEntry(previousHash, {
    returnId: args.returnId,
    userId: args.userId,
    action: AUDIT_ACTIONS.AI_EXTRACT_COMPLETE,
    timestamp,
  });

  await ctx.db.insert('audit', {
    returnId: args.returnId,
    userId: args.userId,
    action: AUDIT_ACTIONS.AI_EXTRACT_COMPLETE,
    triggerSource: 'ai_extraction',
    newValue: { 
      scanId: args.scanId, 
      documentType: args.documentType,
      fieldsApplied: args.fieldsApplied,
      confidence: args.confidence,
    },
    hashChainEntry,
    createdAt: timestamp,
  });
}

async function applyOcrFieldUpdate(
  ctx: InternalCtx,
  args: {
    returnId: string;
    formId: string;
    fieldId: string;
    value: any;
    lastModifiedBy: string;
    meta: any;
    scanId: string;
  }
): Promise<void> {
  const fieldDoc = await ctx.db.query('fields')
    .withIndex('byComposite', (q: any) => 
      q.eq('returnId', args.returnId)
       .eq('formId', args.formId)
       .eq('fieldId', args.fieldId)
    )
    .first();

  if (!fieldDoc) {
    await ctx.db.insert('fields', {
      returnId: args.returnId,
      formId: args.formId,
      fieldId: args.fieldId,
      value: args.value,
      lastModifiedBy: args.lastModifiedBy,
      updatedAt: Date.now(),
      overridden: false,
      calculated: false,
    });
  } else {
    if (fieldDoc.overridden) {
      // Log a warning with full context for debugging
      console.warn(`OCR: Skipping overridden field ${args.formId}.${args.fieldId} for return ${args.returnId} - user has locked this field`);
      // Return early - this is not an error, the field is simply protected
      return;
    }

    await ctx.db.patch(fieldDoc._id, {
      value: args.value,
      lastModifiedBy: args.lastModifiedBy,
      updatedAt: Date.now(),
      overridden: args.meta?.isOverride || false,
      calculated: false,
    });
  }

  const timestamp = Date.now();
  const existingEntries = await ctx.db.query('audit')
    .withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId))
    .collect();
  const previousHash = await getLatestHash(existingEntries);

  const hashChainEntry = await hashEntry(previousHash, {
    returnId: args.returnId,
    formId: args.formId,
    fieldId: args.fieldId,
    userId: args.lastModifiedBy,
    action: AUDIT_ACTIONS.FIELD_UPDATE,
    timestamp,
  });

  await ctx.db.insert('audit', {
    returnId: args.returnId,
    formId: args.formId,
    fieldId: args.fieldId,
    userId: args.lastModifiedBy,
    action: AUDIT_ACTIONS.FIELD_UPDATE,
    triggerSource: 'ai_extraction',
    previousValue: fieldDoc?.value,
    newValue: { value: args.value, scanId: args.scanId },
    hashChainEntry,
    createdAt: timestamp,
  });
}

// ============================================
// Main OCR Action
// ============================================

/**
 * Main OCR extraction action - initiates document scanning
 * This is the entry point for the OCR workflow
 */
export const extractDocument = action({
  args: {
    returnId: v.string(),
    fileId: v.string(),
    documentType: v.string(), // "W2" | "1099" | "ID" | "SSN"
    formType: v.optional(v.string()), // For 1099: "1099-MISC", "1099-NEC", etc.
    taxpayerContext: v.optional(v.string()), // "primary" | "spouse" for SSN/ID docs
  },
  handler: async (ctx, args): Promise<{ 
    success: boolean; 
    scanId?: string; 
    status: string;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, status: 'failed', error: 'Unauthorized' };
    }

    const userId = identity.subject;

    try {
      // 1. Create OCR scan record
      const scanId = await createScanRecord(ctx, {
        returnId: args.returnId,
        fileId: args.fileId,
        userId,
        documentType: args.documentType,
        status: 'processing',
      });

      // 2. Get the file from storage
      const file = await getFileById(ctx, args.fileId);

      if (!file) {
        await updateScanRecord(ctx, {
          scanId,
          status: 'failed',
          errorMessage: 'File not found',
        });
        return { success: false, scanId, status: 'failed', error: 'File not found' };
      }

      // 3. Initialize Ollama client
      const ollamaClient = getOllamaClient();

      // NOTE: Rate limiting is now handled by the OllamaClient's built-in check
      // for development. For production, implement database-backed rate limiting
      // using the rateLimits table in schema.

      // 4. Log audit start
      await logOcrStart(ctx, {
        returnId: args.returnId,
        userId,
        scanId,
        documentType: args.documentType,
      });

      // 6. Extract based on document type
      let result: ExtractionResult;
      
      // Get taxpayer context for SSN mapping (default to primary)
      const taxpayerContext = args.taxpayerContext || 'primary';
      
      // Decrypt file data if needed
      const fileData = file.dataBase64;
      let imageData = '';
      
      if (fileData && typeof fileData === 'object' && '_encrypted' in fileData) {
        imageData = maybeDecryptValue(fileData) as string;
      } else if (typeof fileData === 'string') {
        imageData = fileData;
      }

      switch (args.documentType) {
        case 'W2':
          result = await ollamaClient.extractFromW2(imageData, userId);
          break;
        case '1099':
          result = await ollamaClient.extractFrom1099(imageData, userId, args.formType || '1099-MISC');
          break;
        case 'ID':
          result = await ollamaClient.extractFromID(imageData, userId);
          break;
        case 'SSN':
          result = await ollamaClient.extractFromSSN(imageData, userId);
          break;
        default:
          result = {
            success: false,
            documentType: args.documentType as DocumentType,
            extractedFields: [],
            errorMessage: `Unsupported document type: ${args.documentType}`,
            processingTimeMs: 0,
            modelUsed: '',
            confidence: 0,
          };
      }

      // 7. Handle extraction result
      if (!result.success) {
        const updateResult = await updateScanRecord(ctx, {
          scanId,
          status: 'failed',
          errorMessage: result.errorMessage,
          processingTimeMs: result.processingTimeMs,
        });
        // Log update failure but don't fail the whole operation
        if (!updateResult.success) {
          console.error('Failed to update scan record with failure status:', updateResult.error);
        }
        return { success: false, scanId, status: 'failed', error: result.errorMessage };
      }

      // 7. Map extracted fields to tax form fields
      // For SSN, use taxpayer context to determine correct field mapping
      let mappedFields = mapExtractedFields(result.extractedFields, args.documentType);
      
      // Apply taxpayer context for SSN mapping
      if (args.documentType === 'SSN' && taxpayerContext === 'spouse') {
        const spouseMapping = getSSNTo1040Mapping('spouse');
        mappedFields = mappedFields.map(field => {
          if (field.documentFieldId === 'SSN.number') {
            return { ...field, fieldId: '1040_spouseSSN', dotFieldId: '1040.spouseSSN' };
          }
          if (field.documentFieldId === 'SSN.name') {
            return { ...field, fieldId: '1040_spouseFirstName', dotFieldId: '1040.spouseFirstName' };
          }
          if (field.documentFieldId === 'SSN.dateOfBirth') {
            return { ...field, fieldId: '1040_spouseDateOfBirth', dotFieldId: '1040.spouseDateOfBirth' };
          }
          return field;
        });
      }

      // 9. Validate extracted fields
      const requiredFields = getRequiredFields(args.documentType);
      validateExtractedFields(mappedFields, requiredFields);

      // 10. Update scan with extracted data
      await updateScanRecord(ctx, {
        scanId,
        status: 'completed',
        extractedData: result.extractedFields,
        mappedFields: mappedFields.map(f => ({ ...f, value: undefined })),
        confidence: result.confidence,
        processingTimeMs: result.processingTimeMs,
        modelUsed: result.modelUsed,
      });

      // 11. Apply field updates to tax return
      const fieldUpdates = toFieldUpdates(mappedFields, args.returnId, userId);
      
      for (const update of fieldUpdates) {
        try {
          await applyOcrFieldUpdate(ctx, {
            returnId: update.returnId,
            formId: update.formId,
            fieldId: update.fieldId,
            value: update.value,
            lastModifiedBy: update.lastModifiedBy,
            meta: update.meta,
            scanId,
          });
        } catch (fieldError) {
          console.error(`Failed to apply field update ${update.fieldId}:`, fieldError);
        }
      }

      // 12. Log completion audit
      await logOcrComplete(ctx, {
        returnId: args.returnId,
        userId,
        scanId,
        documentType: args.documentType,
        fieldsApplied: fieldUpdates.length,
        confidence: result.confidence,
      });

      return { 
        success: true, 
        scanId, 
        status: 'completed',
      };

    } catch (error) {
      console.error('OCR extraction failed:', error);
      return { 
        success: false, 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },
});

// ============================================
// Public Queries
// ============================================

/**
 * Get OCR scan status
 */
export const getScanStatus = query({
  args: { scanId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    try {
      return await ctx.db.get(args.scanId as any);
    } catch {
      const scans = await ctx.db.query('ocrScans').collect();
      return scans.find((s: any) => s._id === args.scanId);
    }
  },
});

/**
 * List OCR scans for a return
 */
export const listScansForReturn = query({
  args: { returnId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    return await ctx.db.query('ocrScans')
      .withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId))
      .collect();
  },
});

/**
 * Get rate limit status for user
 */
export const getRateLimitStatus = query({
  args: {},
  handler: async (ctx): Promise<RateLimitInfo> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthorized');

    const ollamaClient = getOllamaClient();
    return ollamaClient.checkRateLimit(identity.subject);
  },
});
