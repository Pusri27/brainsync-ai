'use client';

import React, { useState } from 'react';
import { ActiveTab } from '@/types';
import {
  MessageSquare,
  FileText,
  LayoutDashboard,
  Plus,
  PanelLeftClose,
  PanelLeft,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  Network,
  Activity,
  LogIn,
  LogOut,
  Lock,
} from 'lucide-react';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  documentCount: number;
  onOpenUpload: () => void;
  onNewChat: () => void;
  conversations?: Array<{ id: string; title: string }>;
  currentConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  user: { id: string; name: string; email: string } | null;
  onOpenAuthModal: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  documentCount,
  onOpenUpload,
  onNewChat,
  conversations = [],
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  user,
  onOpenAuthModal,
  onLogout,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { id: 'chat' as ActiveTab, label: 'Chat', icon: MessageSquare },
    { id: 'documents' as ActiveTab, label: 'Documents', icon: FileText, count: documentCount },
    { id: 'graph' as ActiveTab, label: 'Knowledge Graph', icon: Network },
    { id: 'analytics' as ActiveTab, label: 'RAG Analytics', icon: Activity },
    { id: 'dashboard' as ActiveTab, label: 'Overview', icon: LayoutDashboard },
  ];


  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } bg-[#171717] flex flex-col justify-between h-screen sticky top-0 z-30 select-none transition-all duration-200 text-[#ececec] border-r border-[#2a2a2a]`}
    >
      <div>
        {/* Top Header */}
        <div className="p-3 flex items-center justify-between">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-[#2f2f2f] transition-colors cursor-pointer"
            title={collapsed ? 'Open sidebar' : 'Close sidebar'}
          >
            {collapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>

          {!collapsed && (
            <button
              onClick={onNewChat}
              className="p-2 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-[#2f2f2f] transition-colors cursor-pointer"
              title="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* New Chat Full Button */}
        <div className="px-3 pb-2">
          <button
            onClick={onNewChat}
            className={`w-full flex items-center gap-3 bg-[#2f2f2f] hover:bg-[#383838] text-white font-medium text-base rounded-xl py-2.5 transition-colors shadow-sm cursor-pointer ${
              collapsed ? 'justify-center px-0' : 'px-3.5'
            }`}
          >
            <Plus className="w-5 h-5 shrink-0 text-zinc-300" />
            {!collapsed && <span className="truncate">New chat</span>}
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="px-2 py-2 space-y-1 border-b border-[#262626] pb-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-base transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#2f2f2f] text-white font-semibold'
                    : 'text-[#b4b4b4] hover:text-white hover:bg-[#212121]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-[#8e8e93]'}`} />
                  {!collapsed && <span>{item.label}</span>}
                </div>

                {!collapsed && item.count !== undefined && item.count > 0 && (
                  <span className="text-xs font-mono text-[#b4b4b4] bg-[#212121] px-2 py-0.5 rounded-full font-medium">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Recent Chats Section */}
        {!collapsed && (
          <div className="px-3 pt-3 space-y-1 max-h-[calc(100vh-22rem)] overflow-y-auto custom-scrollbar">
            <p className="px-2 pb-1 text-xs font-bold text-[#8e8e93] uppercase tracking-wider">
              Chat History
            </p>

            {!user ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2 my-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Guest Mode (Not Saved)</span>
                </div>
                <p className="text-[11px] text-amber-200/80 leading-snug">
                  Login to save your chat history and uploaded documents permanently across refreshes.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('login')}
                  className="w-full py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3 h-3" />
                  <span>Sign In / Register</span>
                </button>
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-2 text-xs text-[#6e6e73] italic">No chat history yet.</p>
            ) : (
              conversations.map((conv) => {
                const isCurrent = currentConversationId === conv.id;
                return (
                  <div
                    key={conv.id}
                    className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      isCurrent
                        ? 'bg-[#2f2f2f] text-white font-medium'
                        : 'text-[#b4b4b4] hover:text-white hover:bg-[#212121]'
                    }`}
                  >
                    <button
                      onClick={() => {
                        if (onSelectConversation) onSelectConversation(conv.id);
                        setActiveTab('chat');
                      }}
                      className="flex items-center gap-2.5 text-left truncate flex-1 cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0 text-[#8e8e93]" />
                      <span className="truncate">{conv.title}</span>
                    </button>

                    {onDeleteConversation && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#383838] rounded text-[#8e8e93] hover:text-rose-400 transition-all cursor-pointer"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* User Account Tile */}
      <div className="p-3 border-t border-[#212121]">
        {user ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-[#212121] border border-white/5">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow">
                {user.name.charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                onClick={onLogout}
                className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-[#2e2e2e] rounded-lg transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onOpenAuthModal('login')}
            className={`w-full flex items-center gap-2 p-2 rounded-xl bg-[#242428] hover:bg-[#2c2c32] border border-white/5 text-zinc-300 hover:text-white transition-all cursor-pointer ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogIn className="w-4 h-4 text-indigo-400 shrink-0" />
            {!collapsed && (
              <div className="text-left flex-1 truncate">
                <p className="text-xs font-semibold text-white">Sign In / Register</p>
                <p className="text-[10px] text-amber-400/90 font-mono">Guest Mode (Not saved)</p>
              </div>
            )}
          </button>
        )}
      </div>
    </aside>
  );
};
