'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, CheckSquare, Square, Bot, FolderOpen, FileText, Files } from 'lucide-react';

export interface SourceOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface SearchableSourceSelectProps {
  value: string | string[];
  onChange: (value: string[]) => void;
  options: SourceOption[];
  placeholder?: string;
}

export const SearchableSourceSelect: React.FC<SearchableSourceSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select sources...',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize value prop into string array
  const currentValues: string[] = Array.isArray(value)
    ? value
    : value
    ? [value]
    : ['ALL'];

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = options.filter(
    (o) =>
      !query ||
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      (o.description?.toLowerCase().includes(query.toLowerCase()) ?? false)
  );

  const handleToggleOption = (optVal: string) => {
    if (optVal === 'NONE') {
      onChange(['NONE']);
      return;
    }

    if (optVal === 'ALL') {
      onChange(['ALL']);
      return;
    }

    // Specific document selection
    let next: string[] = currentValues.filter((v) => v !== 'ALL' && v !== 'NONE');

    if (next.includes(optVal)) {
      next = next.filter((v) => v !== optVal);
    } else {
      next.push(optVal);
    }

    if (next.length === 0) {
      next = ['ALL'];
    }

    onChange(next);
  };

  // Determine trigger button content with SVG Icons
  const renderTriggerLabel = () => {
    if (currentValues.includes('NONE')) {
      return (
        <span className="flex items-center gap-1.5 truncate text-[#ececec] font-semibold">
          <Bot className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>AI Only</span>
        </span>
      );
    }

    if (currentValues.includes('ALL')) {
      return (
        <span className="flex items-center gap-1.5 truncate text-[#ececec] font-semibold">
          <FolderOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>All Docs ({options.length - 2})</span>
        </span>
      );
    }

    if (currentValues.length === 1) {
      const match = options.find((o) => o.value === currentValues[0]);
      const IconComponent = match?.icon || FileText;
      return (
        <span className="flex items-center gap-1.5 truncate text-[#ececec] font-semibold">
          <IconComponent className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="truncate">{match ? match.label : '1 Doc Selected'}</span>
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1.5 truncate text-[#ececec] font-semibold">
        <Files className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span>{currentValues.length} Docs Selected</span>
      </span>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 bg-[#2f2f2f] border rounded-lg px-2.5 py-1 text-xs font-mono transition-all max-w-[210px] ${
          open ? 'border-zinc-500 ring-1 ring-zinc-600' : 'border-[#383838] hover:border-zinc-600'
        }`}
      >
        {renderTriggerLabel()}
        <ChevronDown
          className={`w-3 h-3 text-[#8e8e93] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 w-72 bg-[#1e1e1e] border border-[#383838] rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-[#2a2a2a] space-y-1.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-8 pr-7 py-1.5 bg-[#2a2a2a] rounded-lg text-xs text-[#ececec] placeholder-[#6e6e73] focus:outline-none focus:ring-1 focus:ring-zinc-600"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between text-[11px] text-[#8e8e93] px-1 pt-0.5">
              <span>Multi-select active</span>
              <button
                type="button"
                onClick={() => onChange(['ALL'])}
                className="hover:text-indigo-300 underline font-medium"
              >
                Reset to All
              </button>
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-[#6e6e73] text-center py-4">
                No results for &ldquo;{query}&rdquo;
              </p>
            ) : (
              filtered.map((opt) => {
                const isChecked =
                  currentValues.includes(opt.value) ||
                  (currentValues.includes('ALL') && opt.value !== 'NONE');
                const IconComponent = opt.icon || FileText;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleToggleOption(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left ${
                      isChecked
                        ? 'bg-[#2f2f2f] text-white font-medium'
                        : 'text-[#b4b4b4] hover:bg-[#2a2a2a] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-[#555] shrink-0" />
                      )}

                      <IconComponent className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{opt.label}</p>
                        {opt.description && (
                          <p className="text-[10px] text-[#6e6e73] truncate">{opt.description}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
