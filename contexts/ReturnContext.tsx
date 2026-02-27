"use client";

import React, { createContext, useContext } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

type ReturnContextType = { isLocked?: boolean; returnDoc?: any };

const ReturnContext = createContext<ReturnContextType | undefined>(undefined);

export function ReturnProvider({ returnId, children }: { returnId?: string; children: React.ReactNode }) {
  const returnDoc = useQuery(api.returns.getReturn, { returnId }) ?? null;
  return <ReturnContext.Provider value={{ isLocked: returnDoc?.isLocked, returnDoc }}>{children}</ReturnContext.Provider>;
}

export function useReturnContext() {
  const ctx = useContext(ReturnContext);
  if (!ctx) throw new Error('useReturnContext must be used within ReturnProvider');
  return ctx;
}

export default ReturnContext;
