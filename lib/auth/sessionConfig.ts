/**
 * Session Configuration Constants
 * Per IRS Publication 1345 compliance requirements
 */

// 15-minute inactivity timeout (IRS Publication 1345 requirement)
export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

// 12-hour mandatory re-authentication for professional preparers
export const REAUTH_TIMEOUT_MS = 12 * 60 * 60 * 1000;

// Session token generation
export const SESSION_TOKEN_BYTES = 32;

// Maximum concurrent sessions per user
export const MAX_CONCURRENT_SESSIONS = 5;

// Session activity check interval (client-side ping frequency)
export const SESSION_PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Role types for access control
export type UserRole = 'taxpayer' | 'preparer' | 'admin';

// MFA methods supported
export type MFAMethod = 'authenticator' | 'sms' | 'email';

// Session status
export type SessionStatus = 'active' | 'expired' | 'reauth_required' | 'terminated';

// Audit action types for login/logout events
export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'auth:login_success',
  LOGIN_FAILURE: 'auth:login_failure',
  LOGOUT: 'auth:logout',
  MFA_VERIFY: 'auth:mfa_verify',
  REAUTH_SUCCESS: 'auth:reauth_success',
  SESSION_EXPIRED: 'auth:session_expired',
  CONCURRENT_SESSION_DENIED: 'auth:concurrent_session_denied',
} as const;
