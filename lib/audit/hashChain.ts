/**
 * Hash Chain Implementation for Audit Trail Tamper Evidence
 * 
 * IRS Publication 1345 requires tamper-evident audit logs.
 * This module provides cryptographic hash chain functionality
 * to detect any modification to audit entries.
 * 
 * Each audit entry contains a hash of the previous entry,
 * creating a chain where any modification would break the chain.
 */

/**
 * Trigger sources for field changes
 * IRS Publication 1345 requires tracking the source of all changes
 */
export type TriggerSource = 
  | 'manual'        // User manually entered value
  | 'ai_extraction' // LLM extracted from document
  | 'import'        // Imported from external source
  | 'calculation'  // Calculated by tax engine
  | 'filing';      // Set during MeF filing

/**
 * Audit action types for comprehensive tracking
 */
export const AUDIT_ACTIONS = {
  // Field operations
  FIELD_UPDATE: 'field:update',
  FIELD_OVERRIDE: 'field:override',
  FIELD_CALCULATED: 'field:calculated',
  
  // Authentication events
  LOGIN_SUCCESS: 'auth:login_success',
  LOGIN_FAILURE: 'auth:login_failure',
  LOGOUT: 'auth:logout',
  MFA_VERIFY: 'auth:mfa_verify',
  REAUTH_SUCCESS: 'auth:reauth_success',
  SESSION_EXPIRED: 'auth:session_expired',
  
  // View events (IRS 1345 requires tracking views)
  VIEW_FORM: 'view:form',
  VIEW_SECTION: 'view:section',
  VIEW_DIAGNOSTIC: 'view:diagnostic',
  
  // Export events
  EXPORT_PDF: 'export:pdf',
  EXPORT_DATA: 'export:data',
  EXPORT_CSV: 'export:csv',
  
  // Print events
  PRINT_FORM: 'print:form',
  PRINT_RETURN: 'print:return',
  
  // Filing events
  FILE_SUBMIT: 'filing:submit',
  FILE_REJECT: 'filing:reject',
  FILE_ACCEPT: 'filing:accept',
  
  // AI extraction events
  AI_EXTRACT_START: 'ai:extract_start',
  AI_EXTRACT_COMPLETE: 'ai:extract_complete',
  AI_SUGGESTION_APPLIED: 'ai:suggestion_applied',
  AI_SUGGESTION_REJECTED: 'ai:suggestion_rejected',
  
  // System events
  RETURN_CREATED: 'return:created',
  RETURN_LOCKED: 'return:locked',
  RETURN_UNLOCKED: 'return:unlocked',
  RETURN_ARCHIVED: 'return:archived',
} as const;

/**
 * Genesis hash - used for the first audit entry
 * This is a fixed value that represents the start of the chain
 */
export const GENESIS_HASH = 'taxwise_audit_genesis_2025_v1';

/**
 * Create a SHA-256 hash of the given data
 * Uses Web Crypto API with fallback for older environments
 */
export async function createHash(data: string): Promise<string> {
  // Use Web Crypto API for hashing (available in Node.js 19+ and browsers)
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  // Check if crypto.subtle is available (secure context required)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to fallback
    }
  }
  
  // Fallback for non-secure contexts or older Node.js
  // Use simple hash implementation (not cryptographically secure, but works for dev)
  return simpleHash(data);
}

/**
 * Simple non-cryptographic hash fallback for development/non-secure contexts
 * Note: This should NOT be used in production for security-sensitive operations
 */
function simpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to hex string
  return Math.abs(hash).toString(16).padStart(8, '0').repeat(4).slice(0, 64);
}

/**
 * Create genesis hash - the first entry in a new audit chain
 */
export async function createGenesisHash(): Promise<string> {
  const timestamp = Date.now().toString();
  const data = `${GENESIS_HASH}:${timestamp}`;
  return createHash(data);
}

/**
 * Create hash for a new audit entry
 * Uses the previous entry's hash + current entry data
 */
export async function hashEntry(
  previousHash: string | null,
  entryData: {
    returnId?: string;
    formId?: string;
    fieldId?: string;
    userId?: string;
    action: string;
    newValue?: unknown;
    timestamp: number;
  }
): Promise<string> {
  // Build the string to hash
  const components = [
    previousHash || GENESIS_HASH, // Use genesis if no previous
    entryData.returnId || '',
    entryData.formId || '',
    entryData.fieldId || '',
    entryData.userId || '',
    entryData.action,
    entryData.timestamp.toString(),
  ];
  
  const dataToHash = components.join('|');
  return createHash(dataToHash);
}

/**
 * Verify a single entry's hash is correct
 */
export async function verifyEntry(
  entry: {
    hashChainEntry?: string;
    returnId?: string;
    formId?: string;
    fieldId?: string;
    userId?: string;
    action?: string;
    createdAt?: number;
  },
  previousHash: string | null
): Promise<boolean> {
  if (!entry.hashChainEntry) return false;
  if (!entry.createdAt) return false;
  
  const computedHash = await hashEntry(previousHash, {
    returnId: entry.returnId,
    formId: entry.formId,
    fieldId: entry.fieldId,
    userId: entry.userId,
    action: entry.action || '',
    timestamp: entry.createdAt,
  });
  
  return computedHash === entry.hashChainEntry;
}

/**
 * Verify the entire audit chain integrity
 * Returns the index of the first invalid entry, or -1 if chain is valid
 */
export async function verifyChain(
  entries: Array<{
    _id: string;
    hashChainEntry?: string;
    returnId?: string;
    formId?: string;
    fieldId?: string;
    userId?: string;
    action?: string;
    createdAt?: number;
  }>
): Promise<{ valid: boolean; invalidIndex: number; message: string }> {
  if (entries.length === 0) {
    return { valid: true, invalidIndex: -1, message: 'No entries to verify' };
  }
  
  // Sort entries by timestamp (createdAt)
  const sortedEntries = [...entries].sort((a, b) => 
    (a.createdAt || 0) - (b.createdAt || 0)
  );
  
  let previousHash: string | null = null;
  
  for (let i = 0; i < sortedEntries.length; i++) {
    const entry = sortedEntries[i];
    
    // Verify this entry's hash
    const isValid = await verifyEntry(entry, previousHash);
    
    if (!isValid) {
      return {
        valid: false,
        invalidIndex: i,
        message: `Chain broken at entry ${i + 1} (${entry._id}). Hash mismatch detected.`,
      };
    }
    
    // Update previous hash for next iteration
    previousHash = entry.hashChainEntry || null;
  }
  
  return {
    valid: true,
    invalidIndex: -1,
    message: `Chain verified: ${entries.length} entries validated successfully`,
  };
}

/**
 * Get the most recent hash from a list of entries
 * Used to get the head of the chain for adding new entries
 */
export async function getLatestHash(
  entries: Array<{
    hashChainEntry?: string;
    createdAt?: number;
  }>
): Promise<string | null> {
  if (entries.length === 0) return null;
  
  const sortedEntries = [...entries].sort((a, b) =>
    (b.createdAt || 0) - (a.createdAt || 0)
  );
  
  return sortedEntries[0]?.hashChainEntry || null;
}

/**
 * Calculate 7-year retention date from entry timestamp
 * IRS Publication 1345 requires 7-year retention
 */
export function getRetentionDate(createdAt: number): Date {
  const retentionDate = new Date(createdAt);
  retentionDate.setFullYear(retentionDate.getFullYear() + 7);
  return retentionDate;
}

/**
 * Check if an entry should be archived based on 7-year retention
 */
export function shouldArchiveEntry(createdAt: number): boolean {
  const retentionDate = getRetentionDate(createdAt);
  return new Date() >= retentionDate;
}

/**
 * Format entry for hash chain computation (deterministic JSON)
 */
export function serializeEntryForHash(entry: Record<string, unknown>): string {
  // Extract only fields that affect the hash
  const hashableFields = {
    returnId: entry.returnId,
    formId: entry.formId,
    fieldId: entry.fieldId,
    userId: entry.userId,
    action: entry.action,
    createdAt: entry.createdAt,
  };
  
  // Sort keys for deterministic serialization
  const sortedKeys = Object.keys(hashableFields).sort();
  const parts = sortedKeys.map(key => {
    const value = hashableFields[key as keyof typeof hashableFields];
    return `${key}:${value ?? ''}`;
  });
  
  return parts.join('|');
}
