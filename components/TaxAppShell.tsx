"use client";

"use client";

import React, { useEffect } from "react";
import { FocusMapProvider } from "../hooks/useFocusMap";
import useTaxKeyboard from "../hooks/useTaxKeyboard";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { ReturnProvider } from "../contexts/ReturnContext";
import RefundMonitor from './RefundMonitor';

export default function TaxAppShell({
  returnId,
  children,
}: {
  returnId?: string;
  children: React.ReactNode;
}) {
  return (
    <FocusMapProvider>
      <ReturnProvider returnId={returnId}>
        <TaxKeyboardInner returnId={returnId}>{children}</TaxKeyboardInner>
      </ReturnProvider>
    </FocusMapProvider>
  );
}

function TaxKeyboardInner({
  returnId,
  children,
}: {
  returnId?: string;
  children: React.ReactNode;
}) {
  useTaxKeyboard(returnId);

  const createSession = useMutation(api.sessions.createSession);
  const pingSession = useMutation(api.sessions.pingSession);

  useEffect(() => {
    let sid: string | null = null;
    (async () => {
      try {
        const res: any = await createSession({ mfaVerified: true });
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

  return (
    <>
      <RefundMonitor />
      {children}
    </>
  );
}
