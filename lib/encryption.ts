// Encryption module using Node.js crypto for server-side operations
import crypto from 'crypto';

const RAW_KEY = process.env.ENCRYPTION_KEY || process.env['ENCRYPTION_KEY'] || 'PLACEHOLDER_KEY';
const USE_KEY = RAW_KEY && RAW_KEY !== 'PLACEHOLDER_KEY';

// Derive a 32-byte key from the passphrase using PBKDF2 with random salt
function getKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(String(RAW_KEY), salt, 100000, 32, 'sha256');
}

function looksLikeSSN(s: string) {
  return /^(\d{3}-?\d{2}-?\d{4})$/.test(s.trim());
}

function looksLikeEIN(s: string) {
  return /^(\d{2}-?\d{7})$/.test(s.trim());
}

function isPossiblyPII(val: any) {
  if (typeof val !== 'string') return false;
  const t = val.trim();
  if (!t) return false;
  return looksLikeSSN(t) || looksLikeEIN(t);
}

/**
 * Encrypt a string using AES-256-GCM with random salt and IV
 * Output format: base64(salt + iv + ciphertext + authTag)
 */
function encryptString(plaintext: string): string {
  if (!USE_KEY) return plaintext;
  
  try {
    // Generate random salt (16 bytes) and IV (12 bytes)
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = getKey(salt);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    
    // Combine: salt (16) + iv (12) + tag (16) + ciphertext
    const result = Buffer.concat([salt, iv, tag, enc]);
    return result.toString('base64');
  } catch (e) {
    // Log error but don't expose details
    console.error('[encryption] Failed to encrypt value:', e instanceof Error ? e.message : 'unknown error');
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt a string that was encrypted with encryptString
 * Input format: base64(salt + iv + ciphertext + authTag)
 */
function decryptString(payload: string): string {
  if (!USE_KEY) return payload;
  
  try {
    const buf = Buffer.from(payload, 'base64');
    
    // Extract components
    const salt = buf.slice(0, 16);
    const iv = buf.slice(16, 28);
    const tag = buf.slice(28, 44);
    const data = buf.slice(44);
    
    const key = getKey(salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    const out = Buffer.concat([decipher.update(data), decipher.final()]);
    return out.toString('utf8');
  } catch (e) {
    console.error('[encryption] Failed to decrypt value:', e instanceof Error ? e.message : 'unknown error');
    throw new Error('Decryption failed');
  }
}

// Async versions for operations that can await
export async function encryptValueAsync(val: any): Promise<any> {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    if (isPossiblyPII(val)) {
      return { _encrypted: true, data: encryptString(val) };
    }
    return val;
  }
  if (Array.isArray(val)) {
    const result = [];
    for (const v of val) {
      result.push(await encryptValueAsync(v));
    }
    return result;
  }
  if (typeof val === 'object') {
    const out: any = {};
    for (const k of Object.keys(val)) {
      out[k] = await encryptValueAsync(val[k]);
    }
    return out;
  }
  return val;
}

export async function decryptValueAsync(val: any): Promise<any> {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object' && val._encrypted && val.data) {
    return decryptString(String(val.data));
  }
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    const result = [];
    for (const v of val) {
      result.push(await decryptValueAsync(v));
    }
    return result;
  }
  if (typeof val === 'object') {
    const out: any = {};
    for (const k of Object.keys(val)) {
      out[k] = await decryptValueAsync(val[k]);
    }
    return out;
  }
  return val;
}

// Sync versions - these work immediately and encrypt/decrypt properly
export function maybeEncryptValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    if (isPossiblyPII(val)) {
      try {
        return { _encrypted: true, data: encryptString(val) };
      } catch (e) {
        // On encryption failure, return original but NOT marked as encrypted
        // Caller can check if result has _encrypted flag
        console.error('[encryption] PII encryption failed, storing plaintext:', val.substring(0, 4) + '...');
        return val;
      }
    }
    return val;
  }
  if (Array.isArray(val)) return val.map((v) => maybeEncryptValue(v));
  if (typeof val === 'object') {
    const out: any = {};
    for (const k of Object.keys(val)) {
      out[k] = maybeEncryptValue(val[k]);
    }
    return out;
  }
  return val;
}

export function maybeDecryptValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object' && val._encrypted && val.data) {
    try {
      return decryptString(String(val.data));
    } catch (e) {
      // Return original data on decryption failure so app doesn't crash
      console.error('[encryption] Decryption failed, returning original value');
      return val.data;
    }
  }
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map((v) => maybeDecryptValue(v));
  if (typeof val === 'object') {
    const out: any = {};
    for (const k of Object.keys(val)) {
      out[k] = maybeDecryptValue(val[k]);
    }
    return out;
  }
  return val;
}

export default { maybeEncryptValue, maybeDecryptValue, encryptValueAsync, decryptValueAsync };
