"use client";

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useFocusMap } from '../hooks/useFocusMap';

export default function FinalReview({ returnId }: { returnId?: string }) {
  const diagnostics = useQuery(api.diagnostics.getDiagnosticsForReturn, { returnId }) ?? [];
  const [locked, setLocked] = useState<boolean>(false);
  const lockReturn = useMutation(api.returns.setReturnLock);
  const { focusField } = useFocusMap();

  const errors = diagnostics.filter((d: any) => d.severity === 'error');
  const warnings = diagnostics.filter((d: any) => d.severity === 'warning');

  const toggleLock = async () => {
    if (!returnId) return;
    await lockReturn({ returnId, locked: !locked });
    setLocked(!locked);
  };

  return (
    <div className="p-4 bg-white border rounded">
      <h2 className="text-lg font-semibold mb-2">Final Review</h2>
      <div className="mb-3">
        <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={toggleLock}>{locked ? 'Unlock Return' : 'Lock Return'}</button>
      </div>
      <section className="mb-4">
        <h3 className="font-medium">Errors</h3>
        {errors.length === 0 ? <div className="text-sm text-gray-500">No errors</div> : (
          <ul className="space-y-1 mt-2">
            {errors.map((e: any, i: number) => (
              <li key={i} className="text-sm text-red-700 cursor-pointer" onClick={() => focusField(e.fieldId)}>{e.message} — {e.fieldId}</li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="font-medium">Warnings</h3>
        {warnings.length === 0 ? <div className="text-sm text-gray-500">No warnings</div> : (
          <ul className="space-y-1 mt-2">
            {warnings.map((w: any, i: number) => (
              <li key={i} className="text-sm text-yellow-700 cursor-pointer" onClick={() => focusField(w.fieldId)}>{w.message} — {w.fieldId}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
