import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { generateMeFXML } from '../lib/mefGenerator';

export const exportMeF = mutation({
  args: { returnId: v.string() },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    const returnDoc = await db.query('returns').withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId)).first();
    if (!returnDoc) throw new Error('Return not found');
    const fields = await db.query('fields').withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId)).collect();
    const xml = generateMeFXML(returnDoc, fields);
    // store as a file for download
    const now = Date.now();
    const file = await db.insert('files', { returnId: args.returnId, filename: `mef_${args.returnId}.xml`, mimeType: 'application/xml', dataBase64: Buffer.from(xml).toString('base64'), metadata: { generatedBy: user.subject }, createdAt: now });
    return { fileId: file._id, xml }; 
  }
});
