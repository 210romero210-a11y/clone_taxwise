import crypto from 'crypto';

const RAW_KEY = process.env.ENCRYPTION_KEY || process.env['ENCRYPTION_KEY'] || 'PLACEHOLDER_KEY';
const USE_KEY = RAW_KEY && RAW_KEY !== 'PLACEHOLDER_KEY';

function getKey(): Buffer {
  // derive a 32-byte key from the provided passphrase
  return crypto.createHash('sha256').update(String(RAW_KEY)).digest();
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

function encryptString(plaintext: string) {
  if (!USE_KEY) return plaintext;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptString(payload: string) {
  if (!USE_KEY) return payload;
  try {
    const key = getKey();
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const data = buf.slice(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]);
    return out.toString('utf8');
  } catch (e) {
    return payload; // if decryption fails, return original
  }
}

export function maybeEncryptValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    if (isPossiblyPII(val)) {
      return { _encrypted: true, data: encryptString(val) };
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
    return decryptString(String(val.data));
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

export default { maybeEncryptValue, maybeDecryptValue };
