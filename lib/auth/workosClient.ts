/**
 * WorkOS Client Wrapper
 * Provides authentication and MFA services per IRS Publication 1345
 * 
 * This module wraps WorkOS SDK for enterprise SSO and MFA authentication.
 * Environment variables required: WORKOS_API_KEY, WORKOS_CLIENT_ID
 */

import { UserRole, MFAMethod } from './sessionConfig';

// WorkOS environment configuration
const WORKOS_API_KEY = process.env.WORKOS_API_KEY;
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;

// Type definitions for WorkOS responses
export interface WorkOSUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

export interface WorkOSAuthenticationFactors {
  id: string;
  type: 'totp' | 'sms' | 'email';
  phoneNumber?: string;
  email?: string;
}

export interface WorkOSAuthentication {
  user: WorkOSUser;
  factors: WorkOSAuthenticationFactors[];
  authenticationChallengeId: string;
}

export interface WorkOSSession {
  sessionId: string;
  userId: string;
  expiresAt: Date;
}

/**
 * Generate a secure session token
 * Uses Web Crypto API which works in modern browsers, Node.js 19+, and Edge Runtime
 */
export function generateSessionToken(): string {
  // Use Web Crypto API - available in all modern environments
  // (Node.js 19+, browsers, and Edge Runtime)
  const bytes = new Uint8Array(32);
  
  // Check if crypto.getRandomValues is available (browsers, Node.js 19+)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else if (typeof require !== 'undefined') {
    // Fallback for older Node.js environments
    try {
      const cryptoModule = require('crypto');
      const randomBytes = cryptoModule.randomBytes(32);
      bytes.set(randomBytes);
    } catch {
      // Last resort fallback - less secure
      for (let i = 0; i < 32; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
  } else {
    // Last resort fallback - less secure
    for (let i = 0; i < 32; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  
  // Convert to hex string
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if WorkOS is properly configured
 */
export function isWorkOSConfigured(): boolean {
  return !!(WORKOS_API_KEY && WORKOS_CLIENT_ID);
}

/**
 * Validate email format for authentication
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Determine user role based on WorkOS user metadata
 * Professional preparers have 'preparer' role for enhanced security
 */
export function determineUserRole(user: WorkOSUser): UserRole {
  // Check for preparer indicators in user metadata
  // In production, this would check WorkOS organization membership or custom attributes
  const email = user.email.toLowerCase();
  
  // Tax professional indicators
  const preparerDomains = ['cpa', 'tax', 'accounting', 'enrolled'];
  const isPreparer = preparerDomains.some(domain => 
    email.includes(domain) || user.firstName?.toLowerCase().includes(domain)
  );
  
  return isPreparer ? 'preparer' : 'taxpayer';
}

/**
 * Get supported MFA methods for a user
 * Returns available MFA factors from WorkOS
 */
export async function getSupportedMFAMethods(userId: string): Promise<MFAMethod[]> {
  if (!isWorkOSConfigured()) {
    // Return default methods if WorkOS is not configured (development mode)
    return ['authenticator', 'sms', 'email'];
  }
  
  // In production with WorkOS, this would call WorkOS API
  // to list authentication factors for the user
  try {
    // Placeholder for WorkOS API call
    // const workos = new WorkOS(WORKOS_API_KEY);
    // const factors = await workos.mfa.listFactors({ userId });
    return ['authenticator', 'sms', 'email'];
  } catch (error) {
    console.error('Failed to get MFA methods:', error);
    return ['authenticator'];
  }
}

/**
 * Authenticate user with WorkOS (initial authentication)
 * In production, this creates a WorkOS authentication session
 */
export async function authenticateWithWorkOS(
  email: string,
  password: string,
  ipAddress?: string
): Promise<{ user: WorkOSUser; requiresMFA: boolean; authId?: string }> {
  if (!isWorkOSConfigured()) {
    // Development mode: simulate authentication
    const devUser: WorkOSUser = {
      id: `dev_${Date.now()}`,
      email,
      firstName: 'Test',
      lastName: 'User',
      createdAt: new Date().toISOString(),
    };
    return { user: devUser, requiresMFA: true };
  }

  // Production: Use WorkOS SDK
  // const workos = new WorkOS(WORKOS_API_KEY);
  // const authResult = await workos.authenticateWithPassword({
  //   clientId: WORKOS_CLIENT_ID,
  //   email,
  //   password,
  //   ipAddress,
  // });
  
  // Placeholder for production implementation
  throw new Error('WorkOS production authentication not implemented - configure WORKOS_API_KEY and WORKOS_CLIENT_ID');
}

/**
 * Verify MFA code for authentication
 */
export async function verifyMFA(
  authId: string,
  code: string,
  factorType: MFAMethod
): Promise<{ success: boolean; sessionToken?: string }> {
  if (!isWorkOSConfigured()) {
    // Development mode: accept any 6-digit code
    if (/^\d{6}$/.test(code)) {
      return { success: true, sessionToken: generateSessionToken() };
    }
    return { success: false };
  }

  // Production: Use WorkOS SDK
  // const workos = new WorkOS(WORKOS_API_KEY);
  // const result = await workos.mfa.verifyChallenge({
  //   authenticationChallengeId: authId,
  //   code,
  // });
  
  // Placeholder for production implementation
  throw new Error('WorkOS MFA verification not implemented - configure WORKOS_API_KEY and WORKOS_CLIENT_ID');
}

/**
 * Send MFA code via selected method (SMS/Email)
 */
export async function sendMFACode(
  userId: string,
  method: 'sms' | 'email'
): Promise<{ challengeId: string }> {
  if (!isWorkOSConfigured()) {
    // Development mode: return mock challenge
    return { challengeId: `dev_challenge_${Date.now()}` };
  }

  // Production: Use WorkOS SDK
  // const workos = new WorkOS(WORKOS_API_KEY);
  // const challenge = await workos.mfa.challenge({
  //   authenticationFactorId: factorId,
  // });
  
  // Placeholder for production implementation
  throw new Error('WorkOS MFA challenge not implemented - configure WORKOS_API_KEY and WORKOS_CLIENT_ID');
}

/**
 * Log authentication event for audit trail
 */
export interface AuditLogEntry {
  userId: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: number;
  success: boolean;
  failureReason?: string;
}

export async function logAuthEvent(entry: AuditLogEntry): Promise<void> {
  // Log to console in development
  console.log('[AUTH AUDIT]', JSON.stringify(entry));
  
  // In production, this would send to a secure audit logging service
  // or store in the Convex audit table
}

/**
 * Validate IP address format
 */
export function isValidIPAddress(ip: string): boolean {
  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Get client IP from request headers (Convex/http)
 */
export function getClientIP(request: Request): string | undefined {
  // Check common headers for client IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return undefined;
}

// Convex validators - import in convex functions, not lib files
export const authValidators = {
  email: 'email',
  password: 'password',
  mfaCode: 'mfaCode',
  sessionToken: 'sessionToken',
  ipAddress: 'ipAddress',
};

export default {
  generateSessionToken,
  isWorkOSConfigured,
  isValidEmail,
  determineUserRole,
  getSupportedMFAMethods,
  authenticateWithWorkOS,
  verifyMFA,
  sendMFACode,
  logAuthEvent,
  isValidIPAddress,
  getClientIP,
};
