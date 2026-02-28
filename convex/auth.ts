/**
 * Authentication Actions and Mutations
 * Per IRS Publication 1345 compliance requirements
 * 
 * Features:
 * - WorkOS authentication integration
 * - MFA verification flow
 * - 12-hour re-authentication for professional preparers
 * - Login/logout audit trail
 */

import { action, mutation, internalAction } from './_generated/server';
import { v } from 'convex/values';
import { 
  isWorkOSConfigured, 
  authenticateWithWorkOS, 
  verifyMFA, 
  sendMFACode,
  determineUserRole,
  generateSessionToken,
  isValidEmail,
  isValidIPAddress,
} from '../lib/auth/workosClient';
import { 
  AUDIT_ACTIONS,
  MFAMethod,
  UserRole,
  REAUTH_TIMEOUT_MS,
} from '../lib/auth/sessionConfig';

/**
 * Internal function to record audit events (called from mutations/actions)
 */
async function recordAuditInternal(
  db: any,
  userId: string,
  action: string,
  sessionId?: string,
  ipAddress?: string,
  details?: Record<string, any>
): Promise<void> {
  await db.insert('audit', {
    userId,
    sessionId,
    ipAddress,
    action,
    ...details,
    createdAt: Date.now(),
  });
}

/**
 * Initial authentication with WorkOS
 * Returns authentication challenge if MFA is required
 * 
 * Note: This is an action - cannot access db directly
 */
export const authenticate = action({
  args: { 
    email: v.string(),
    password: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (_, args): Promise<{
    success: boolean;
    requiresMFA?: boolean;
    authId?: string;
    userId?: string;
    role?: UserRole;
    error?: string;
  }> => {
    // Validate inputs
    if (!isValidEmail(args.email)) {
      return { success: false, error: 'Invalid email format' };
    }

    if (args.ipAddress && !isValidIPAddress(args.ipAddress)) {
      console.warn('[AUTH] Invalid IP address format:', args.ipAddress);
    }

    try {
      const result = await authenticateWithWorkOS(args.email, args.password, args.ipAddress);
      
      if (result.requiresMFA) {
        // Note: Audit logging for initial auth will happen after MFA verification
        return {
          success: true,
          requiresMFA: true,
          authId: result.authId,
          userId: result.user.id,
          role: determineUserRole(result.user),
        };
      }

      // MFA not required - return role info
      const role = determineUserRole(result.user);

      return {
        success: true,
        userId: result.user.id,
        role,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Authentication failed',
      };
    }
  }
});

/**
 * Verify MFA code and prepare session creation
 * Returns session token for client to use
 * 
 * Note: The role should be passed from the client (obtained from authenticate action response)
 */
export const verifyMFAForSession = action({
  args: { 
    userId: v.string(),
    authId: v.string(),
    mfaCode: v.string(),
    factorType: v.string(),
    ipAddress: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (_, args): Promise<{
    success: boolean;
    sessionToken?: string;
    role?: UserRole;
    error?: string;
  }> => {
    // Validate MFA code format
    if (!/^\d{6}$/.test(args.mfaCode)) {
      return { success: false, error: 'Invalid MFA code format' };
    }

    // Verify the MFA code
    const result = await verifyMFA(args.authId, args.mfaCode, args.factorType as MFAMethod);
    
    if (!result.success) {
      return { success: false, error: 'Invalid MFA code' };
    }

    // Determine user role - prefer passed role, fallback to heuristic for dev mode
    let role: UserRole = 'taxpayer';
    if (args.role && (args.role === 'taxpayer' || args.role === 'preparer' || args.role === 'admin')) {
      role = args.role as UserRole;
    } else {
      // Fallback heuristic for development - should use proper auth in production
      const isDevMode = !isWorkOSConfigured();
      if (isDevMode && args.userId) {
        role = args.userId.startsWith('dev_') ? 'taxpayer' : 
               args.userId.includes('preparer') ? 'preparer' : 'taxpayer';
      }
    }

    // Get or generate session token
    const sessionToken = result.sessionToken || generateSessionToken();

    return {
      success: true,
      sessionToken,
      role,
    };
  }
});

/**
 * Internal action to create session with full audit logging
 * This can be called after MFA verification
 */
export const createSessionWithAudit = mutation({
  args: { 
    userId: v.string(),
    mfaVerified: v.boolean(),
    ipAddress: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async ({ db }, args) => {
    const now = Date.now();
    const userRole = (args.role as UserRole) || 'taxpayer';
    const isPreparer = userRole === 'preparer';
    const MAX_CONCURRENT_SESSIONS = 5;

    // Check concurrent session limits
    const existingSessions = await db.query('sessions')
      .withIndex('byUserId', (q: any) => q.eq('userId', args.userId))
      .collect();
    
    const activeSessions = existingSessions.filter((s: any) => 
      s.status !== 'terminated' && s.status !== 'expired'
    );

    if (activeSessions.length >= MAX_CONCURRENT_SESSIONS) {
      // Log the denied session attempt
      await recordAuditInternal(
        db, 
        args.userId, 
        AUDIT_ACTIONS.CONCURRENT_SESSION_DENIED,
        undefined,
        args.ipAddress,
        { activeCount: activeSessions.length, maxAllowed: MAX_CONCURRENT_SESSIONS }
      );
      throw new Error(`Maximum concurrent sessions (${MAX_CONCURRENT_SESSIONS}) exceeded`);
    }

    const sessionId = `s_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    
    // Prepare session data
    const sessionData: any = {
      sessionId,
      userId: args.userId,
      mfaVerified: !!args.mfaVerified,
      lastActivity: now,
      createdAt: now,
      role: userRole,
      ipAddress: args.ipAddress,
      status: 'active',
    };

    // Add re-auth requirements for professional preparers
    if (isPreparer) {
      sessionData.reauthRequired = true;
      sessionData.reauthAt = now + REAUTH_TIMEOUT_MS;
    }

    await db.insert('sessions', sessionData);

    // Log successful session creation
    await recordAuditInternal(
      db,
      args.userId,
      AUDIT_ACTIONS.MFA_VERIFY,
      sessionId,
      args.ipAddress,
      { role: userRole }
    );

    return { sessionId, createdAt: now, role: userRole };
  }
});

/**
 * Send MFA code via selected method
 */
export const sendMFAChallenge = action({
  args: { 
    userId: v.string(),
    method: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (_, args): Promise<{
    success: boolean;
    challengeId?: string;
    error?: string;
  }> => {
    if (args.method !== 'sms' && args.method !== 'email') {
      return { success: false, error: 'Invalid MFA method' };
    }

    try {
      const result = await sendMFACode(args.userId, args.method as 'sms' | 'email');
      
      return {
        success: true,
        challengeId: result.challengeId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to send MFA code',
      };
    }
  }
});

/**
 * Logout - terminate session
 */
export const logout = mutation({
  args: { 
    sessionId: v.string(),
  },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');

    // Look up the session
    const session = await db.query('sessions')
      .withIndex('bySessionId', (q: any) => q.eq('sessionId', args.sessionId))
      .first();

    if (!session) {
      throw new Error('Session not found');
    }

    // Verify ownership
    if (session.userId !== user.subject) {
      throw new Error('Cannot terminate another user\'s session');
    }

    // Terminate session
    await db.patch('sessions', session._id, { status: 'terminated' });

    // Log the logout
    await recordAuditInternal(
      db,
      user.subject,
      AUDIT_ACTIONS.LOGOUT,
      args.sessionId,
      session.ipAddress,
      { reason: 'user_initiated' }
    );

    return { success: true };
  }
});

/**
 * Re-authenticate for professional preparers
 * Required every 12 hours per IRS Publication 1345
 */
export const reauthenticate = mutation({
  args: { 
    sessionId: v.string(),
    mfaCode: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');

    // Get session
    const session = await db.query('sessions')
      .withIndex('bySessionId', (q: any) => q.eq('sessionId', args.sessionId))
      .first();

    if (!session) throw new Error('Session not found');
    if (session.userId !== user.subject) throw new Error('Unauthorized');

    // Validate MFA code
    if (!/^\d{6}$/.test(args.mfaCode)) {
      throw new Error('Invalid MFA code format');
    }

    // In production, verify against stored auth challenge
    // For now, accept any 6-digit code in dev mode
    const isDevMode = !isWorkOSConfigured();
    const isValidCode = isDevMode ? /^\d{6}$/.test(args.mfaCode) : false;

    if (!isValidCode) {
      await recordAuditInternal(
        db,
        user.subject,
        AUDIT_ACTIONS.LOGIN_FAILURE,
        args.sessionId,
        args.ipAddress,
        { reason: 'invalid_reauth_code' }
      );
      
      throw new Error('Invalid MFA code');
    }

    const now = Date.now();
    const newReauthAt = now + REAUTH_TIMEOUT_MS;

    // Update session with new re-auth timestamp
    await db.patch('sessions', session._id, {
      mfaVerified: true,
      status: 'active',
      reauthRequired: false,
      reauthAt: newReauthAt,
      lastActivity: now,
    });

    await recordAuditInternal(
      db,
      user.subject,
      AUDIT_ACTIONS.REAUTH_SUCCESS,
      args.sessionId,
      args.ipAddress,
      { newReauthAt }
    );

    return {
      success: true,
      newReauthAt,
    };
  }
});

/**
 * Check if WorkOS is properly configured
 */
export const checkWorkOSStatus = mutation({
  args: {},
  handler: async (): Promise<{
    configured: boolean;
    message: string;
  }> => {
    const configured = isWorkOSConfigured();
    
    return {
      configured,
      message: configured 
        ? 'WorkOS is configured' 
        : 'WorkOS not configured - using development mode',
    };
  }
});

/**
 * Get supported MFA methods for user
 */
export const getSupportedMFAMethods = action({
  args: { 
    userId: v.string(),
  },
  handler: async (_, args): Promise<{
    methods: MFAMethod[];
  }> => {
    // Import dynamically to avoid issues in dev mode
    const { getSupportedMFAMethods: getMethods } = await import('../lib/auth/workosClient');
    const methods = await getMethods(args.userId);
    
    return { methods };
  }
});
