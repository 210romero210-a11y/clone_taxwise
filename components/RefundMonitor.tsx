"use client";

import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useReturnContext } from '../contexts/ReturnContext';

interface RefundMonitorProps {
  returnId?: string;
}

export default function RefundMonitor({ returnId }: RefundMonitorProps) {
  const { returnDoc } = useReturnContext();
  
  // Use aggregate query for sub-100ms updates (if available)
  // Falls back to returnDoc if aggregate not yet computed
  const aggregate = useQuery(
    api.returns.getAggregate,
    returnId ? { returnId } : { returnId: "" }
  );

  // Use aggregate values if available, otherwise fall back to returnDoc
  const refund = aggregate?.refund ?? returnDoc?.refund ?? 0;
  const taxLiability = aggregate?.taxLiability ?? returnDoc?.taxLiability ?? 0;
  const lastUpdated = aggregate?.lastUpdated;

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Show last update time
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="w-full bg-gradient-to-r from-blue-50 to-white border-b p-2 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-700">
          Return: {returnDoc?.returnId || returnId || '—'} — Year: {returnDoc?.year || '—'}
        </div>
        {lastUpdated && (
          <div className="text-xs text-gray-400">
            Updated: {formatTime(lastUpdated)}
          </div>
        )}
      </div>
      
      <div className="flex items-baseline gap-6">
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">Tax Due</div>
          <div className="text-lg font-semibold text-red-600">
            {formatCurrency(taxLiability)}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-500">Refund</div>
          <div className={`text-lg font-semibold ${refund >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {formatCurrency(Math.abs(refund))}
            {refund < 0 && <span className="text-xs ml-1">(owed)</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
