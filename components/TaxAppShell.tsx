"use client";

import React, { useEffect, useState } from "react";
import { FocusMapProvider } from "../hooks/useFocusMap";
import useTaxKeyboard from "../hooks/useTaxKeyboard";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { ReturnProvider } from "../contexts/ReturnContext";
import { UIModeProvider, useUIMode } from "../contexts/UIModeContext";
import RefundMonitor from "./RefundMonitor";
import UIModeToggle from "./UIModeToggle";
import LocaleToggle from "./LocaleToggle";
import InterviewModeWizard from "./InterviewModeWizard";
import FormModeGrid from "./FormModeGrid";
import ValidationPanel from "./ValidationPanel";
import TimelineViewer from "./TimelineViewer";
import clsx from "clsx";

interface TaxAppShellProps {
  returnId?: string;
  children?: React.ReactNode;
}

// Main shell with all providers
export default function TaxAppShell({
  returnId,
  children,
}: TaxAppShellProps) {
  return (
    <UIModeProvider defaultMode="form">
      <FocusMapProvider>
        <ReturnProvider returnId={returnId}>
          <TaxAppShellInner returnId={returnId}>
            {children}
          </TaxAppShellInner>
        </ReturnProvider>
      </FocusMapProvider>
    </UIModeProvider>
  );
}

// Inner component with keyboard and mode handling
function TaxAppShellInner({
  returnId,
  children,
}: {
  returnId?: string;
  children?: React.ReactNode;
}) {
  const { mode } = useUIMode();
  
  useTaxKeyboard(returnId);

  const createSession = useMutation(api.sessions.createSession);
  const pingSession = useMutation(api.sessions.pingSession);

  // Session management
  // NOTE: In production, mfaVerified should come from auth context after proper MFA verification
  // For now, this creates a session in dev mode. In production, implement proper auth flow.
  const sessionNeedsMfa = !process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID; // Dev mode check
  useEffect(() => {
    let sid: string | null = null;
    (async () => {
      try {
        // In production with WorkOS, session should be created after proper MFA verification
        // The mfaVerified flag should reflect actual auth state, not be hardcoded
        const res: any = await createSession({ 
          mfaVerified: sessionNeedsMfa, // Only true in dev mode
          ipAddress: typeof window !== 'undefined' ? undefined : undefined
        });
        sid = res?.sessionId;
        if (sid) localStorage.setItem('sessionId', sid);
      } catch (e) {
        // session creation failed — proceed without session
      }
    })();

    const ping = () => {
      const s = localStorage.getItem('sessionId');
      if (s) void pingSession({ sessionId: s });
    };

    const onActivity = () => {
      ping();
    };
    window.addEventListener('mousemove', onActivity);
    window.addEventListener('keydown', onActivity);
    const id = setInterval(() => ping(), 2 * 60 * 1000);

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('keydown', onActivity);
      clearInterval(id);
    };
  }, [createSession, pingSession]);

  // Show children if provided, otherwise show default dual-mode view
  if (children) {
    return <>{children}</>;
  }

  // Default dual-mode interface
  return (
    <div className="flex flex-col h-screen">
      {/* Header with Refund Monitor and Mode Toggle */}
      <header className="flex-shrink-0">
        <RefundMonitor />
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900">TaxWise Clone</h1>
            <UIModeToggle variant="tabs" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500" title="Session active" />
              <span className="text-gray-600">Active</span>
            </div>
            <LocaleToggle variant="tabs" size="sm" />
            <div className="text-sm text-gray-500">
              {mode === "interview" ? "Interview Mode" : "Form Mode"}
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Validation Panel */}
        <aside className="w-72 bg-white border-r border-gray-200 overflow-auto flex-shrink-0">
          <ValidationPanel returnId={returnId} />
        </aside>

        {/* Main content - Interview or Form Mode */}
        <main className="flex-1 overflow-hidden bg-gray-50">
          {mode === "interview" ? (
            <InterviewModeWizard returnId={returnId} />
          ) : (
            <FormModeGrid returnId={returnId} />
          )}
        </main>

        {/* Right sidebar - Timeline (Flight Recorder) */}
        <aside className="w-80 bg-white border-l border-gray-200 overflow-hidden flex-shrink-0">
          <TimelineViewer returnId={returnId} />
        </aside>
      </div>
    </div>
  );
}
