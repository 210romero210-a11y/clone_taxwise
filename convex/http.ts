import { httpAction } from './_generated/server';

export const serveFile = httpAction({
  handler: async (ctx: any, req: Request) => {
    try {
      const url = new URL(req.url);
      const returnId = url.searchParams.get('returnId');
      const filename = url.searchParams.get('filename');
      if (!returnId || !filename) return new Response('Missing returnId or filename', { status: 400 });

      // Find the file by returnId and filename
      const files = await ctx.db.query('files').withIndex('byReturnId', (q: any) => q.eq('returnId', returnId)).collect();
      const file = files.find((f: any) => f.filename === filename);
      if (!file) return new Response('Not found', { status: 404 });

      // Prefer storage-backed files when possible
      if (file.storageId && ctx.storage) {
        try {
          // Try several commonly available APIs for signed URLs
          if (typeof ctx.storage.getSignedUrl === 'function') {
            const signed = await ctx.storage.getSignedUrl(file.storageId);
            return new Response(null, { status: 302, headers: { Location: signed } });
          }
          if (typeof ctx.storage.getUrl === 'function') {
            const signed = await ctx.storage.getUrl(file.storageId);
            return new Response(null, { status: 302, headers: { Location: signed } });
          }
        } catch (e) {
          // fall through to returning payload
        }
      }

      // Fallback: return base64 payload as bytes
      if (file.dataBase64) {
        const buf = Buffer.from(file.dataBase64, 'base64');
        return new Response(buf, { status: 200, headers: { 'Content-Type': file.mimeType || 'application/octet-stream' } });
      }

      return new Response('No payload available', { status: 404 });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('serveFile error', e);
      return new Response('Internal error', { status: 500 });
    }
  }
});
import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';

const http = httpRouter();

// Serve template PDFs or stored files. Clients can call /templates?fileId=<id>
http.route({
  path: '/templates',
  method: 'GET',
  handler: httpAction(async (ctx: any, req: Request) => {
    const url = new URL(req.url);
    const fileId = url.searchParams.get('fileId');
    if (!fileId) return new Response('fileId required', { status: 400 });

    // Try to load the file doc
    const fileDoc = await ctx.db.get('files', fileId as any);
    if (!fileDoc) return new Response('not found', { status: 404 });

    // If stored in Convex storage, get a signed URL and redirect
    const storageId = (fileDoc as any).storageId;
    const storage = (ctx as any).storage;
    if (storageId && storage && typeof storage.getUrl === 'function') {
      try {
        const signed = await storage.getUrl(storageId);
        if (signed) return new Response(null, { status: 302, headers: { Location: signed } });
      } catch (e) {
        // ignore and fall back to returning payload
      }
    }

    // Fallback: return base64 payload if present
    if ((fileDoc as any).dataBase64) {
      const bytes = Buffer.from((fileDoc as any).dataBase64, 'base64');
      return new Response(bytes, { status: 200, headers: { 'Content-Type': fileDoc.mimeType || 'application/octet-stream' } });
    }

    return new Response('not available', { status: 404 });
  }),
});

export default http;
