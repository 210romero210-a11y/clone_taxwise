"use client";

import React from "react";
import { FocusMapProvider } from "../hooks/useFocusMap";
import useTaxKeyboard from "../hooks/useTaxKeyboard";

export default function TaxAppShell({
  returnId,
  children,
}: {
  returnId?: string;
  children: React.ReactNode;
}) {
  return (
    <FocusMapProvider>
      <TaxKeyboardInner returnId={returnId}>{children}</TaxKeyboardInner>
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
  return <>{children}</>;
}
