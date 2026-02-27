import { query } from './_generated/server';
import { v } from 'convex/values';

// Read-only audit log query for Publication 1345 compliance. Returns
// append-only entries for a given returnId. No mutations are provided here.
export const listAuditForReturn = query({
  args: { returnId: v.string() },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    // In production you would ensure the user can access the requested returnId
    return await db.query('audit').withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId)).collect();
  }
});
