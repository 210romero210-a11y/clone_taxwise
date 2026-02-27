import { applyFieldUpdate } from '../convex/internalFunctions';
import { generatePDF } from '../lib/printEngine';

function makeMockDb() {
  const state: any = {
    returns: [],
    fields: [],
    audit: [],
    files: [],
    sessions: [],
  };

  function query(collection: string) {
    return {
      withIndex: (_indexName: string, cb: (q: any) => any) => {
        const qBuilder: any = { conds: [] };
        qBuilder.eq = function (k: string, v: any) { this.conds.push([k, v]); return this; };
        cb(qBuilder);
        return {
          first: async () => {
            const conds = qBuilder.conds;
            const arr = state[collection] || [];
            return arr.find((d: any) => conds.every(([k, v]: any) => String(d[k]) === String(v)));
          },
          collect: async () => {
            const conds = qBuilder.conds;
            const arr = state[collection] || [];
            return arr.filter((d: any) => conds.every(([k, v]: any) => String(d[k]) === String(v)));
          }
        };
      },
      collect: async () => state[collection] || []
    };
  }

  async function insert(collection: string, doc: any) {
    const id = `_${collection}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const d = { ...doc, _id: id };
    state[collection].push(d);
    return d;
  }

  async function patch(id: string, patchObj: any) {
    for (const col of Object.keys(state)) {
      const idx = state[col].findIndex((x: any) => x._id === id);
      if (idx !== -1) {
        state[col][idx] = { ...state[col][idx], ...patchObj };
        return state[col][idx];
      }
    }
    throw new Error('doc not found');
  }

  return { state, query, insert, patch };
}

describe('End-to-end return flow (mocked DB)', () => {
  test('audit log, print mapping, and locking behavior', async () => {
    const db = makeMockDb();

    // Seed return and field
    const ret = await db.insert('returns', { returnId: 'r1', taxpayerId: 'u1', year: 2025, forms: {}, events: [] });
    const field = await db.insert('fields', { returnId: 'r1', formId: 'W2', fieldId: 'box1', value: 10000, overridden: false });

    // Create a dummy active session for user
    await db.insert('sessions', { sessionId: 's1', userId: 'u1', mfaVerified: true, lastActivity: Date.now(), createdAt: Date.now() });

    const actor = { userId: 'u1', name: 'testuser', sessionId: 's1', ipAddress: '127.0.0.1' };

    // Apply field update
    const res = await applyFieldUpdate(db, actor, 'r1', 'W2', 'box1', 50000, { isOverride: false });
    expect(res.updated).toBe(true);

    // Verify field updated
    const updatedField = db.state.fields.find((f: any) => f._id === field._id);
    expect(updatedField.value).toBe(50000);

    // Verify audit recorded
    const auditEntry = db.state.audit.find((a: any) => a.fieldId === 'box1' && a.returnId === 'r1');
    expect(auditEntry).toBeDefined();
    expect(auditEntry.previousValue).toBe(10000);

    // Test print engine mapping
    const mappingJson = {
      form: '1040_2025_Page1',
      template_url: '/templates/f1040_2025.pdf',
      dimensions: { width: 612, height: 792 },
      mappings: [
        { id: '1040_Line1z', field_name: 'TotalWages', coordinates: { x: 505, y: 420 }, type: 'currency', source: 'W2.box1' }
      ]
    };

    const pdfOut = await generatePDF({ returnDoc: ret, fields: db.state.fields, template: mappingJson, watermark: true, filename: 'client-copy.pdf' });
    expect(pdfOut.report).toBeDefined();
    const mapped = pdfOut.report.pages[0].fields.find((f: any) => f.id === '1040_Line1z');
    expect(mapped.value).toBe(50000);

    // Now lock the return and ensure updates fail
    await db.patch(ret._id, { isLocked: true });
    await expect(applyFieldUpdate(db, actor, 'r1', 'W2', 'box1', 60000)).rejects.toThrow('Return is locked');
  });
});
