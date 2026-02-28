"use client";

import React from "react";
import { useUIMode, UIMode } from "../contexts/UIModeContext";
import clsx from "clsx";

interface UIModeToggleProps {
  className?: string;
  variant?: "tabs" | "buttons" | "icon";
  showLabels?: boolean;
}

export function UIModeToggle({ 
  className, 
  variant = "tabs",
  showLabels = true 
}: UIModeToggleProps) {
  const { mode, setMode } = useUIMode();

  const modes: { value: UIMode; label: string; icon: string }[] = [
    { value: "interview", label: "Interview", icon: "📝" },
    { value: "form", label: "Form", icon: "📋" },
  ];

  // Tab variant (default)
  if (variant === "tabs") {
    return (
      <div className={clsx("flex rounded-lg bg-gray-100 p-1", className)}>
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={clsx(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              mode === m.value
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            )}
            aria-pressed={mode === m.value}
          >
            <span className="text-base">{m.icon}</span>
            {showLabels && <span>{m.label}</span>}
          </button>
        ))}
      </div>
    );
  }

  // Button variant
  if (variant === "buttons") {
    return (
      <div className={clsx("flex gap-2", className)}>
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={clsx(
              "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              mode === m.value
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            )}
            aria-pressed={mode === m.value}
          >
            <span className="text-base">{m.icon}</span>
            {showLabels && <span>{m.label}</span>}
          </button>
        ))}
      </div>
    );
  }

  // Icon-only variant
  return (
    <div className={clsx("flex gap-1", className)}>
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => setMode(m.value)}
          className={clsx(
            "flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition-all",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            mode === m.value
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-white hover:bg-gray-50"
          )}
          aria-pressed={mode === m.value}
          title={`Switch to ${m.label} mode`}
        >
          {m.icon}
        </button>
      ))}
    </div>
  );
}

export default UIModeToggle;
