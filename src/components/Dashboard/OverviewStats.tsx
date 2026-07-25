'use client';

import React from 'react';
import { DocumentItem, ActiveTab } from '@/types';
import {
  FileText,
  Layers,
  Zap,
  MessageSquare,
  Network,
  CheckCircle2,
  Clock,
  ArrowRight,
  Lock,
  LogIn,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface OverviewStatsProps {
  documents: DocumentItem[];
  setActiveTab: (tab: ActiveTab) => void;
  onOpenUpload: () => void;
  user?: { id: string; name: string; email: string } | null;
  onOpenAuthModal?: (mode?: 'login' | 'register') => void;
}

export const OverviewStats: React.FC<OverviewStatsProps> = ({
  documents,
  setActiveTab,
  onOpenUpload,
  user,
  onOpenAuthModal,
}) => {
  const totalChunks = documents.reduce((acc, doc) => acc + doc.chunksCount, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4">
      <div>
        <h2 className="text-xl font-bold text-[#ececec]">Overview</h2>
        <p className="text-xs text-[#b4b4b4] mt-0.5">
          BrainSync AI RAG System Metrics & Knowledge Base.
        </p>
      </div>

      {!user && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-300">You are currently using Guest Mode</p>
              <p className="text-[11px] text-amber-200/80 mt-0.5">
                Documents and chat history in guest mode are temporary. Sign in to save them permanently to Neon PostgreSQL.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenAuthModal?.('login')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In / Register</span>
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#2f2f2f] p-4 rounded-2xl space-y-1">
          <p className="text-xs text-[#b4b4b4]">Ingested Documents</p>
          <p className="text-2xl font-bold text-[#ececec] font-mono">{documents.length}</p>
        </div>

        <div className="bg-[#2f2f2f] p-4 rounded-2xl space-y-1">
          <p className="text-xs text-[#b4b4b4]">Vector Chunks</p>
          <p className="text-2xl font-bold text-[#ececec] font-mono">{totalChunks}</p>
        </div>

        <div className="bg-[#2f2f2f] p-4 rounded-2xl space-y-1">
          <p className="text-xs text-[#b4b4b4]">Vector Engine</p>
          <p className="text-2xl font-bold text-emerald-400 font-mono">1536d Ready</p>
        </div>
      </div>

      {/* Quick Launchers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => setActiveTab('chat')}
          className="bg-[#2f2f2f] hover:bg-[#383838] p-5 rounded-2xl cursor-pointer transition-colors space-y-3 group"
        >
          <div className="flex items-center justify-between text-[#ececec]">
            <span className="font-semibold text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" /> Start RAG Chat
            </span>
            <ArrowRight className="w-4 h-4 text-[#8e8e93] group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-xs text-[#b4b4b4] leading-relaxed">
            Chat with your documents in real-time with precise citations.
          </p>
        </div>

        <div
          onClick={() => setActiveTab('graph')}
          className="bg-[#2f2f2f] hover:bg-[#383838] p-5 rounded-2xl cursor-pointer transition-colors space-y-3 group"
        >
          <div className="flex items-center justify-between text-[#ececec]">
            <span className="font-semibold text-sm flex items-center gap-2">
              <Network className="w-4 h-4 text-purple-400" /> Explore Knowledge Graph
            </span>
            <ArrowRight className="w-4 h-4 text-[#8e8e93] group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-xs text-[#b4b4b4] leading-relaxed">
            Visualize relationships and connections between your documents.
          </p>
        </div>
      </div>

      {/* Recent Documents Table */}
      <div className="bg-[#2f2f2f] rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-[#ececec]">Indexed Files</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#383838] text-[#8e8e93]">
                <th className="pb-2 px-2 font-normal">NAME</th>
                <th className="pb-2 px-2 font-normal">TYPE</th>
                <th className="pb-2 px-2 font-normal">CHUNKS</th>
                <th className="pb-2 px-2 font-normal">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#383838]">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-[#383838]/50 transition-colors">
                  <td className="py-2.5 px-2 font-medium text-[#ececec] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#8e8e93]" />
                    <span>{doc.title}</span>
                  </td>
                  <td className="py-2.5 px-2 text-[#b4b4b4] font-mono text-[11px]">{doc.fileType}</td>
                  <td className="py-2.5 px-2 text-[#b4b4b4] font-mono">{doc.chunksCount}</td>
                  <td className="py-2.5 px-2 text-emerald-400 font-medium text-[11px]">Ready</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
