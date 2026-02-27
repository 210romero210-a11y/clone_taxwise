"use client";

import React from 'react';
import { useReturnContext } from '../contexts/ReturnContext';

export default function RefundMonitor() {
  const { returnDoc } = useReturnContext();
  if (!returnDoc) return null;
  const refund = returnDoc.refund ?? 0;
  const taxLiability = returnDoc.taxLiability ?? 0;
  return (
    <div className="w-full bg-gradient-to-r from-blue-50 to-white border-b p-2 flex items-center justify-between">
      <div className="text-sm text-gray-700">Return: {returnDoc.returnId} — Year: {returnDoc.year}</div>
      <div className="flex items-baseline gap-4">
        <div className="text-xs text-gray-500">Refund</div>
        <div className="text-lg font-semibold text-green-700">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(refund)}</div>
        <div className="text-xs text-gray-500">Tax Due</div>
        <div className="text-lg font-semibold text-red-600">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(taxLiability)}</div>
      </div>
    </div>
  );
}
