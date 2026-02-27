import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { safePatch } from './internalFunctions';

function makeSessionId() {
  return `s_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

export const createSession = mutation({
  args: { mfaVerified: v.boolean() },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    if (!args.mfaVerified) throw new Error('MFA verification required to create a server session');
    const sid = makeSessionId();
    const now = Date.now();
    await db.insert('sessions', {
      sessionId: sid,
      userId: user.subject,
      mfaVerified: !!args.mfaVerified,
      lastActivity: now,
      createdAt: now,
    });
    return { sessionId: sid, createdAt: now };
  }
});

export const pingSession = mutation({
  args: { sessionId: v.string() },
  handler: async ({ db }, args) => {
    // Indexed lookup by sessionId (avoid collecting entire table)
    const s = await db.query('sessions').withIndex('bySessionId', (q: any) => q.eq('sessionId', args.sessionId)).first();
    if (!s) throw new Error('Session not found');
    await safePatch(db, 'sessions', s._id, { lastActivity: Date.now() });
    return { ok: true };
  }
});

// Basic query to fetch sessions for a user (used by server-side checks)
export const listSessionsForUser = query({
  args: { userId: v.string() },
  handler: async ({ db }, args) => {
    return await db.query('sessions').withIndex('byUserId', (q: any) => q.eq('userId', args.userId)).collect();
  }
});
