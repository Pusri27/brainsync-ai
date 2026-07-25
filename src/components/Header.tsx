'use client';

import React from 'react';
import { ActiveTab } from '@/types';
import { ModelSelector } from '@/components/ModelSelector';
import { Upload, Search, RefreshCw, X, LogIn, LogOut } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  onOpenUpload: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onNavigateToDocuments: () => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  isSyncing?: boolean;
  onRefresh?: () => void;
  user: { id: string; name: string; email: string } | null;
  onOpenAuthModal: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenUpload,
  searchQuery,
  setSearchQuery,
  onNavigateToDocuments,
  selectedModel,
  setSelectedModel,
  isSyncing = false,
  onRefresh,
  user,
  onOpenAuthModal,
  onLogout,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.length > 0 && activeTab !== 'documents') {
      onNavigateToDocuments();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <header className="h-16 bg-[#212121] px-6 flex items-center justify-between sticky top-0 z-20 border-b border-[#2a2a2a]">
      {/* Model Switcher & Live Auto-Sync Badge */}
      <div className="flex items-center gap-3">
        <ModelSelector
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          user={user}
          onOpenAuthModal={onOpenAuthModal}
        />

        {/* Live Sync Status Indicator */}
        <button
          onClick={onRefresh}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#292929] border border-[#333333] hover:border-[#444] text-[11px] font-mono text-[#a1a1a1] hover:text-white transition-all"
          title="Auto-sync active (click to sync immediately)"
        >
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isSyncing ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isSyncing ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
          </span>
          <span className="font-semibold text-xs tracking-tight">
            {isSyncing ? 'Syncing...' : 'Auto-Sync Active'}
          </span>
          <RefreshCw className={`w-3 h-3 text-[#8e8e93] ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-3">
        {/* Search — navigates to Documents tab automatically */}
        <div className="relative hidden md:block w-56">
          <Search className="w-4 h-4 text-[#8e8e93] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search documents..."
            className="w-full pl-9 pr-8 py-2 bg-[#2f2f2f] border border-transparent rounded-xl text-sm text-[#ececec] placeholder-[#8e8e93] focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600 transition-all"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-white transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Upload Button */}
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-2 bg-[#2f2f2f] hover:bg-[#383838] text-white font-medium text-sm px-3.5 py-2 rounded-xl transition-colors shadow-sm cursor-pointer"
        >
          <Upload className="w-4 h-4 text-indigo-400" />
          <span>Upload</span>
        </button>

        {/* Authentication Button / User Profile */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-[#333]">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#292929] border border-[#383838]">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-white hidden lg:inline">{user.name}</span>
            </div>
            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-[#292929] transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onOpenAuthModal('login')}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
          >
            <LogIn className="w-4 h-4" />
            <span>Login / Register</span>
          </button>
        )}
      </div>
    </header>
  );
};
