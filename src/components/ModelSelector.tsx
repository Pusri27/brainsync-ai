'use client';

import React, { useState, useRef, useEffect } from 'react';
import { OPENROUTER_MODELS, AIModelOption } from '@/lib/models';
import { 
  ChevronDown, 
  Cpu, 
  Sparkles, 
  Lock, 
  Check, 
  Search, 
  Zap, 
  Code, 
  GitMerge, 
  ShieldCheck, 
  Bot 
} from 'lucide-react';

interface ModelSelectorProps {
  selectedModel: string;
  setSelectedModel: (modelId: string) => void;
  user: { id: string; name: string; email: string } | null;
  onOpenAuthModal: (mode?: 'login' | 'register') => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  setSelectedModel,
  user,
  onOpenAuthModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'chat' | 'code' | 'rerank'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = OPENROUTER_MODELS.find((m) => m.id === selectedModel) || OPENROUTER_MODELS[0];

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectModel = (model: AIModelOption) => {
    const isLocked = !user && model.isPremium;
    if (isLocked) {
      setIsOpen(false);
      onOpenAuthModal('login');
      return;
    }
    setSelectedModel(model.id);
    setIsOpen(false);
  };

  const getProviderBadgeStyle = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'nvidia':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60';
      case 'openai':
        return 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60';
      case 'google':
        return 'bg-blue-950/60 text-blue-400 border-blue-800/60';
      case 'cohere':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/60';
      case 'poolside':
        return 'bg-purple-950/60 text-purple-400 border-purple-800/60';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'code':
        return <Code className="w-3.5 h-3.5 text-indigo-400" />;
      case 'rerank':
        return <GitMerge className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Bot className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const filteredModels = OPENROUTER_MODELS.filter((model) => {
    const matchesSearch =
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (model.description && model.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory =
      activeCategory === 'all' ? true : model.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all duration-200 cursor-pointer text-left select-none ${
          isOpen
            ? 'bg-[#2f2f35] border-indigo-500/50 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-500/10'
            : 'bg-[#27272a] border-[#38383e] hover:bg-[#2d2d32] hover:border-zinc-600'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 shrink-0">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
        </div>

        <div className="flex flex-col min-w-0 max-w-[160px] sm:max-w-[210px]">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#ececec] truncate tracking-tight">
              {currentModel.name}
            </span>
            {!user && currentModel.isPremium ? (
              <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
                <Lock className="w-2.5 h-2.5" />
                Login
              </span>
            ) : currentModel.isPremium ? (
              <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                PRO
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                Free
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-zinc-400 truncate">
            {currentModel.provider}
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-zinc-400 ml-1 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-[#161618] border border-zinc-800 shadow-2xl rounded-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header & Search */}
          <div className="space-y-2 mb-2 pb-2.5 border-b border-zinc-800/80">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                Select AI Model
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                {filteredModels.length} models available
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, provider..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#202023] border border-zinc-700/60 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                autoFocus
              />
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 pt-1 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'chat', label: 'Chat' },
                  { id: 'code', label: 'Code' },
                  { id: 'rerank', label: 'Rerank' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold'
                      : 'bg-[#202023] text-zinc-400 hover:text-zinc-200 border border-transparent hover:bg-zinc-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Model Options List */}
          <div className="max-h-72 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
            {filteredModels.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500 font-mono">
                No matching models found
              </div>
            ) : (
              filteredModels.map((model) => {
                const isSelected = model.id === selectedModel;
                const isLocked = !user && model.isPremium;

                return (
                  <div
                    key={model.id}
                    onClick={() => handleSelectModel(model)}
                    className={`group relative flex items-start gap-3 p-2.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/30 border-indigo-500/50 shadow-sm'
                        : 'bg-[#1c1c1f] border-zinc-800/80 hover:bg-[#252529] hover:border-zinc-700'
                    }`}
                  >
                    {/* Category Icon */}
                    <div className="mt-0.5 p-1.5 rounded-lg bg-[#25252a] border border-zinc-700/50 group-hover:border-zinc-600 shrink-0">
                      {getCategoryIcon(model.category)}
                    </div>

                    {/* Model Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs font-semibold truncate ${
                            isSelected ? 'text-indigo-200 font-bold' : 'text-zinc-200 group-hover:text-white'
                          }`}>
                            {model.name}
                          </span>

                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${getProviderBadgeStyle(model.provider)}`}>
                            {model.provider}
                          </span>
                        </div>

                        {/* Status Badges */}
                        {isLocked ? (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
                            <Lock className="w-2.5 h-2.5" />
                            Login required
                          </span>
                        ) : isSelected ? (
                          <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shrink-0">
                            <Check className="w-3 h-3 text-indigo-400" />
                            Active
                          </span>
                        ) : model.isPremium ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 shrink-0">
                            PRO
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                            Free
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {model.description && (
                        <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1 group-hover:text-zinc-300">
                          {model.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Guest Mode Footer Notice */}
          {!user && (
            <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 px-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                Sign in to unlock all PRO models
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenAuthModal('login');
                }}
                className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline cursor-pointer"
              >
                Sign In &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
