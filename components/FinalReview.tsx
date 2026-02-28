"use client";

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useFocusMap } from '../hooks/useFocusMap';
import { useTranslation } from '../contexts/LocaleContext';
import { LanguageIndicator } from './LocaleToggle';

export default function FinalReview({ returnId }: { returnId?: string }) {
  const diagnostics = useQuery(api.diagnostics.getDiagnosticsForReturn, { returnId }) ?? [];
  const [locked, setLocked] = useState<boolean>(false);
  const [filing, setFiling] = useState<boolean>(false);
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error'} | null>(null);
  const lockReturn = useMutation(api.returns.setReturnLock);
  const { focusField } = useFocusMap();
  const { t, locale } = useTranslation();

  const errors = diagnostics.filter((d: any) => d.severity === 'error');
  const warnings = diagnostics.filter((d: any) => d.severity === 'warning');
  const hasErrors = errors.length > 0;

  const toggleLock = async () => {
    if (!returnId) return;
    await lockReturn({ returnId, locked: !locked });
    setLocked(!locked);
  };

  const handleFileElectronically = () => {
    if (!returnId || hasErrors) return;
    setFiling(true);
    // Simulate filing initiation (actual MeF integration would call convex mutation)
    setTimeout(() => {
      setFiling(false);
      // Show success notification instead of alert
      setNotification({
        message: locale === 'es' ? 'Preparación de presentación iniciada' : 'Filing preparation initiated',
        type: 'success'
      });
      // Auto-dismiss notification after 3 seconds
      setTimeout(() => setNotification(null), 3000);
    }, 1000);
  };

  return (
    <div className="p-4 bg-white border rounded">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{t('finalReview.title')}</h2>
        <LanguageIndicator />
      </div>
      
      {/* Action buttons */}
      <div className="mb-4 flex gap-3">
        <button 
          className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
          onClick={toggleLock}
        >
          {locked ? t('finalReview.unlock') : t('finalReview.lock')}
        </button>
        <button 
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            hasErrors 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
          onClick={handleFileElectronically}
          disabled={hasErrors || filing}
        >
          {filing ? t('finalReview.filing') : t('finalReview.fileElectronically')}
        </button>
      </div>

      {/* Errors section */}
      <section className="mb-4">
        <h3 className="font-medium flex items-center gap-2">
          {t('finalReview.errors')}
          {errors.length > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {errors.length}
            </span>
          )}
        </h3>
        {errors.length === 0 ? (
          <div className="text-sm text-gray-500 mt-2">{t('finalReview.noErrors')}</div>
        ) : (
          <ul className="space-y-1 mt-2">
            {errors.map((e: any, i: number) => (
              <li 
                key={i} 
                className="text-sm text-red-700 cursor-pointer hover:underline"
                onClick={() => focusField(e.fieldId)}
              >
                {e.message} — <span className="font-mono text-xs">{e.fieldId}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Warnings section */}
      <section>
        <h3 className="font-medium flex items-center gap-2">
          {t('finalReview.warnings')}
          {warnings.length > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              {warnings.length}
            </span>
          )}
        </h3>
        {warnings.length === 0 ? (
          <div className="text-sm text-gray-500 mt-2">{t('finalReview.noWarnings')}</div>
        ) : (
          <ul className="space-y-1 mt-2">
            {warnings.map((w: any, i: number) => (
              <li 
                key={i} 
                className="text-sm text-yellow-700 cursor-pointer hover:underline"
                onClick={() => focusField(w.fieldId)}
              >
                {w.message} — <span className="font-mono text-xs">{w.fieldId}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Notification toast */}
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${
          notification.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-sm font-medium">{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
