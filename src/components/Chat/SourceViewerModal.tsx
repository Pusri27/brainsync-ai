'use client';

import React from 'react';
import { DocumentChunk } from '@/types';
import { FileText, X, Percent, Bookmark } from 'lucide-react';

interface SourceViewerModalProps {
  citation: DocumentChunk | null;
  onClose: () => void;
}

export const SourceViewerModal: React.FC<SourceViewerModalProps> = ({
  citation,
  onClose,
}) => {
  if (!citation) return null;

  const scorePercentage = Math.round(citation.similarityScore * 100);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#212121] text-[#ececec] w-full max-w-xl rounded-2xl p-5 space-y-4 shadow-2xl border border-[#383838]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#383838] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#2f2f2f] text-zinc-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-base">Vector Citation Details</h4>
              <p className="text-xs text-[#8e8e93] font-mono">{citation.documentTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e8e93] hover:text-white hover:bg-[#2f2f2f] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-[#2f2f2f] space-y-1">
            <span className="text-[11px] text-[#8e8e93] font-medium flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-emerald-400" /> Vector Similarity Score
            </span>
            <p className="text-lg font-bold text-emerald-400 font-mono">
              {scorePercentage}% <span className="text-xs font-normal text-[#8e8e93]">({citation.similarityScore})</span>
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#2f2f2f] space-y-1">
            <span className="text-[11px] text-[#8e8e93] font-medium flex items-center gap-1">
              <Bookmark className="w-3.5 h-3.5 text-zinc-300" /> Page / Chunk ID
            </span>
            <p className="text-lg font-bold text-zinc-200 font-mono">
              Page {citation.pageNumber || 1} <span className="text-xs font-normal text-[#8e8e93]">({citation.id})</span>
            </p>
          </div>
        </div>

        {/* Original Content Snippet */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-300">Original Extracted Context:</label>
          <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#383838] text-zinc-200 text-xs leading-relaxed font-mono whitespace-pre-wrap max-h-56 overflow-y-auto">
            {citation.content}
          </div>
        </div>

        <div className="pt-2 border-t border-[#383838] flex items-center justify-between">
          <span className="text-[11px] text-[#8e8e93]">Retrieval via Neon pgvector</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
