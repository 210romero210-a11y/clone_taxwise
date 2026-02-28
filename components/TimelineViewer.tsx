"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { LucideClock, LucideUser, LucideSystem, LucideSearch, LucideFilter, LucideDownload } from "lucide-react";
import clsx from "clsx";

export interface AuditEntry {
  _id: string;
  returnId?: string;
  formId?: string;
  fieldId?: string;
  userId?: string;
  actor?: string;
  sessionId?: string;
  ipAddress?: string;
  action?: string;
  previousValue?: any;
  newValue?: any;
  createdAt?: number;
}

interface TimelineViewerProps {
  returnId?: string;
  limit?: number;
  onEntryClick?: (entry: AuditEntry) => void;
  className?: string;
}

export function TimelineViewer({
  returnId,
  limit = 50,
  onEntryClick,
  className,
}: TimelineViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [filterActor, setFilterActor] = useState<string | null>(null);

  // Fetch audit entries from Convex
  const entries = useQuery(
    api.audit.listAuditForReturn,
    returnId ? { returnId } : { returnId: "" }
  );

  // Filter and search entries
  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    
    let result = entries as AuditEntry[];
    
    // Filter by action type
    if (filterAction) {
      result = result.filter(e => e.action === filterAction);
    }
    
    // Filter by actor
    if (filterActor) {
      result = result.filter(e => e.actor === filterActor);
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.fieldId?.toLowerCase().includes(query) ||
        e.formId?.toLowerCase().includes(query) ||
        e.actor?.toLowerCase().includes(query) ||
        e.action?.toLowerCase().includes(query)
      );
    }
    
    // Limit results
    return result.slice(0, limit);
  }, [entries, filterAction, filterActor, searchQuery, limit]);

  // Get unique action types for filter
  const actionTypes = useMemo(() => {
    if (!entries) return [];
    const types = new Set((entries as AuditEntry[]).map(e => e.action).filter(Boolean));
    return Array.from(types);
  }, [entries]);

  // Get unique actors for filter
  const actors = useMemo(() => {
    if (!entries) return [];
    const actorSet = new Set((entries as AuditEntry[]).map(e => e.actor).filter(Boolean));
    return Array.from(actorSet);
  }, [entries]);

  // Format timestamp
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Format value for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "null";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  // Get action color
  const getActionColor = (action?: string) => {
    switch (action) {
      case "field:update":
        return "bg-blue-100 text-blue-800";
      case "calculation:run":
        return "bg-green-100 text-green-800";
      case "override":
        return "bg-pink-100 text-pink-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Check if entry is from system
  const isSystemEntry = (entry: AuditEntry) => {
    return entry.actor === "system" || entry.actor === "engine" || entry.actor === "calculation";
  };

  // Export to CSV
  const handleExport = () => {
    const headers = ["Timestamp", "Actor", "Action", "Form", "Field", "Previous Value", "New Value"];
    const rows = filteredEntries.map(e => [
      formatTimestamp(e.createdAt),
      e.actor || "",
      e.action || "",
      e.formId || "",
      e.fieldId || "",
      formatValue(e.previousValue),
      formatValue(e.newValue),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_${returnId || "export"}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render a single entry
  const renderEntry = (entry: AuditEntry) => {
    const isSystem = isSystemEntry(entry);
    
    return (
      <button
        key={entry._id}
        onClick={() => onEntryClick?.(entry)}
        className="w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={clsx(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            isSystem ? "bg-blue-100" : "bg-gray-100"
          )}>
            {isSystem ? (
              <LucideSystem className="w-4 h-4 text-blue-600" />
            ) : (
              <LucideUser className="w-4 h-4 text-gray-600" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", getActionColor(entry.action))}>
                {entry.action || "unknown"}
              </span>
              <span className="text-xs text-gray-500">
                {formatTimestamp(entry.createdAt)}
              </span>
            </div>
            
            <div className="text-sm">
              <span className="font-medium text-gray-900">{entry.actor || "Unknown"}</span>
              {entry.fieldId && (
                <span className="text-gray-600">
                  {" "}updated <span className="font-mono text-xs">{entry.fieldId}</span>
                </span>
              )}
            </div>
            
            {/* Value changes */}
            {(entry.previousValue !== undefined || entry.newValue !== undefined) && (
              <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
                <span className="line-through">{formatValue(entry.previousValue)}</span>
                <span>→</span>
                <span className="font-medium text-gray-700">{formatValue(entry.newValue)}</span>
              </div>
            )}
            
            {/* Metadata */}
            {entry.ipAddress && (
              <div className="mt-1 text-xs text-gray-400">
                IP: {entry.ipAddress}
              </div>
            )}
          </div>
        </div>
      </button>
    );
  };

  // Empty state
  if (!entries || entries.length === 0) {
    return (
      <div className={clsx("p-6 text-center", className)}>
        <LucideClock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">No audit entries found</p>
        <p className="text-xs text-gray-400 mt-1">
          Field changes and calculations will appear here
        </p>
      </div>
    );
  }

  return (
    <div className={clsx("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Audit Timeline</h3>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <LucideDownload className="w-3 h-3" />
            Export
          </button>
        </div>
        
        {/* Search */}
        <div className="relative mb-3">
          <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={filterAction || ""}
            onChange={(e) => setFilterAction(e.target.value || null)}
            className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5"
          >
            <option value="">All Actions</option>
            {actionTypes.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          
          <select
            value={filterActor || ""}
            onChange={(e) => setFilterActor(e.target.value || null)}
            className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1.5"
          >
            <option value="">All Actors</option>
            {actors.map(actor => (
              <option key={actor} value={actor}>{actor}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Entries list */}
      <div className="flex-1 overflow-auto">
        {filteredEntries.map(renderEntry)}
      </div>
      
      {/* Footer */}
      <div className="p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 text-center">
        Showing {filteredEntries.length} of {entries.length} entries
      </div>
    </div>
  );
}

export default TimelineViewer;
