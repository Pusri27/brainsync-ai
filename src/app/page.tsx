'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ActiveTab, DocumentItem, ChatMessage } from '@/types';
import { OPENROUTER_MODELS } from '@/lib/models';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { OverviewStats } from '@/components/Dashboard/OverviewStats';
import { DocumentManager } from '@/components/Documents/DocumentManager';
import { ChatInterface } from '@/components/Chat/ChatInterface';
import KnowledgeGraph from '@/components/Dashboard/KnowledgeGraph';
import RagAnalytics from '@/components/Dashboard/RagAnalytics';
import { ToastContainer, ToastMessage } from '@/components/Toast';
import { AuthModal } from '@/components/AuthModal';


export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'login' | 'register'>('login');

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string }>>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>(OPENROUTER_MODELS[4].id); // Default to guest-supported model
  const [streamingConvId, setStreamingConvId] = useState<string | null>(null);
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const currentConvIdRef = useRef<string | null>(currentConversationId);
  const userRef = useRef<{ id: string; name: string; email: string } | null>(null);
  const documentsRef = useRef<DocumentItem[]>([]);

  useEffect(() => {
    currentConvIdRef.current = currentConversationId;
  }, [currentConversationId]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  const isCurrentChatStreaming =
    streamingConvId !== null &&
    (streamingConvId === currentConversationId || (streamingConvId === 'NEW' && !currentConversationId));

  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const checkUserSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          return data.user;
        }
      }
    } catch (err) {
      console.warn('Auth check error:', err);
    }
    setUser(null);
    return null;
  };

  const fetchLatestData = async (silent = true) => {
    if (!silent) setIsSyncing(true);
    try {
      const docRes = await fetch('/api/documents');
      if (docRes.ok) {
        const docData = await docRes.json();
        if (docData.documents && Array.isArray(docData.documents)) {
          // Only overwrite documents from server if user is logged in
          // Guest in-memory docs must NOT be wiped by the empty [] returned from GET /api/documents
          if (userRef.current) {
            setDocuments(docData.documents);
          }
        }
      }

      const convRes = await fetch('/api/chats');
      if (convRes.ok) {
        const convData = await convRes.json();
        if (convData.conversations && Array.isArray(convData.conversations)) {
          if (userRef.current) {
            setConversations(convData.conversations);
          }
        }
      }
    } catch (err) {
      console.warn('Could not refresh data from backend API:', err);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  // Ref to prevent concurrent duplicate fetches while one is already in-flight
  const isFetchingRef = useRef(false);
  const fetchLatestDataSafe = async (silent = true) => {
    if (isFetchingRef.current) return; // skip if previous fetch not yet done
    isFetchingRef.current = true;
    try {
      await fetchLatestData(silent);
    } finally {
      isFetchingRef.current = false;
    }
  };

  const handleOpenAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalInitialMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Logout error:', err);
    }
    setUser(null);
    setDocuments([]);
    setConversations([]);
    setMessages([]);
    setCurrentConversationId(null);
    showToast('info', 'Signed out. Switched to Guest Mode.');
  };

  const handleAuthSuccess = async (authUser: { id: string; name: string; email: string }) => {
    setUser(authUser);

    // Auto-migrate guest session (documents & chat messages) to user's account
    const guestDocIds = documents.map((d) => d.id);
    if (guestDocIds.length > 0 || messages.length > 0) {
      showToast('info', 'Saving your guest session documents and chat to your account...');
      try {
        const claimRes = await fetch('/api/auth/claim-guest-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentIds: guestDocIds,
            messages: messages,
          }),
        });

        if (claimRes.ok) {
          const claimData = await claimRes.json();
          showToast('success', 'Your guest session data has been saved to your account!');
          if (claimData.conversationId) {
            setCurrentConversationId(claimData.conversationId);
          }
        }
      } catch (err) {
        console.warn('Failed to claim guest session:', err);
      }
    }

    await fetchLatestDataSafe(true);
  };

  // 1. Initial load + Session Check + Polling ONLY while documents are being processed
  const hasProcessing = documents.some((d) => d.status === 'PROCESSING');

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!mounted) return;
      const currentUser = await checkUserSession();
      if (currentUser) {
        await fetchLatestDataSafe(true);
      }
    };

    init();

    let interval: NodeJS.Timeout | null = null;
    if (hasProcessing && user) {
      // Use 6s interval (not 2s) to give Neon time to respond before sending next request
      interval = setInterval(() => fetchLatestDataSafe(true), 6000);
    }

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [hasProcessing, Boolean(user)]); // eslint-disable-line react-hooks/exhaustive-deps


  // 2. Fetch real messages when currentConversationId changes
  useEffect(() => {
    if (!currentConversationId || !user) return;

    let isSubscribed = true;

    async function loadMessages() {
      try {
        const res = await fetch(`/api/chats/${currentConversationId}`);
        if (res.ok && isSubscribed) {
          const data = await res.json();
          if (data.messages && Array.isArray(data.messages)) {
            const formattedMsgs: ChatMessage[] = data.messages.map((m: any) => ({
              id: m.id,
              sender: m.sender,
              content: m.content,
              timestamp: m.createdAt
                ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              citations: m.citations,
            }));
            if (isSubscribed) {
              setMessages(formattedMsgs);
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching conversation messages:', err);
      }
    }

    loadMessages();

    return () => {
      isSubscribed = false;
    };
  }, [currentConversationId, user]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random()}`,
      type,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setSuggestedFollowUps([]);
    setActiveTab('chat');
    showToast('info', 'New chat session started.');
    if (user) fetchLatestData(true);
  };

  const handleSelectConversation = (id: string) => {
    if (!user) {
      handleOpenAuthModal('login');
      return;
    }
    setCurrentConversationId(id);
    setSuggestedFollowUps([]);
    setActiveTab('chat');
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/chats/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Error deleting conversation:', err);
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setMessages([]);
    }
    showToast('info', 'Chat history deleted.');
    if (user) fetchLatestData(true);
  };

  const handleUploadDocument = async (file: File): Promise<DocumentItem | null> => {
    // Guest Mode Document Restriction: Max 1 document allowed
    if (!user && documents.length >= 1) {
      showToast('error', 'Guest Mode limit reached (Maximum 1 document). Please Sign In or Register for unlimited document uploads.');
      handleOpenAuthModal('login');
      return null;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fileSizeStr = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    const ext = file.name.split('.').pop()?.toUpperCase() || 'TXT';
    let fileType = 'TXT';
    if (ext === 'PDF') fileType = 'PDF';
    else if (ext === 'MD') fileType = 'Markdown';
    else if (['PNG', 'JPG', 'JPEG', 'WEBP'].includes(ext)) fileType = 'Image (OCR)';
    else if (['MP3', 'WAV', 'M4A', 'OGG'].includes(ext)) fileType = 'Audio Transcript';

    const tempDoc: DocumentItem = {
      id: tempId,
      title: file.name,
      filePath: `/storage/docs/${file.name}`,
      fileType,
      fileSize: fileSizeStr,
      status: 'PROCESSING',
      chunksCount: 0,
      createdAt: new Date().toISOString(),
    };

    // Immediately insert temporary document so it displays instantly in UI list
    setDocuments((prev) => [tempDoc, ...prev]);

    showToast('info', `Uploading "${file.name}"...`);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.document) {
          if (user) {
            showToast('success', `Document "${file.name}" indexed & saved to account!`);
            setDocuments((prev) =>
              prev.map((d) => (d.id === tempId ? { ...data.document } : d))
            );
            await fetchLatestData(true);
          } else {
            showToast('info', `Document "${file.name}" indexed in Guest Mode. Sign in to save permanently.`);
            setDocuments((prev) =>
              prev.map((d) => (d.id === tempId ? { ...data.document } : d))
            );
          }
          return data.document as DocumentItem;
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast('error', errData.error || `Failed to upload "${file.name}"`);
        setDocuments((prev) => prev.filter((d) => d.id !== tempId));
      }
    } catch (err) {
      console.warn('Upload API error:', err);
      showToast('error', `Failed to upload "${file.name}"`);
      setDocuments((prev) => prev.filter((d) => d.id !== tempId));
    }
    return null;
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Delete document API error:', err);
    }
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    showToast('info', 'Document removed.');
    if (user) fetchLatestData(true);
  };

  const handleSendMessage = async (text: string, selectedDocumentId?: string | string[], urls?: string[], webSearch?: boolean) => {

    const activeConvId = currentConversationId;
    const targetConvKey = activeConvId || 'NEW';

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    if (currentConvIdRef.current === activeConvId) {
      setMessages((prev) => [...prev, userMsg]);
    }
    setStreamingConvId(targetConvKey);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          model: selectedModel,
          conversationId: activeConvId,
          selectedDocumentId: selectedDocumentId,
          urls: urls ?? [],
          webSearch: webSearch ?? false,
          documentIds: documentsRef.current.map((d) => d.id),
          guestHistory: messages.map((m) => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sender: 'assistant',
          content: data.content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          citations: data.citations,
        };

        const newConvId = data.conversationId || activeConvId;

        // Update active screen messages only if user is still on the originating conversation
        if (
          currentConvIdRef.current === activeConvId ||
          (!activeConvId && (currentConvIdRef.current === null || currentConvIdRef.current === newConvId))
        ) {
          setMessages((prev) => [...prev, aiMsg]);
          if (data.suggestedFollowUps && Array.isArray(data.suggestedFollowUps)) {
            setSuggestedFollowUps(data.suggestedFollowUps);
          }
          if (newConvId && currentConvIdRef.current !== newConvId && currentConvIdRef.current === null) {
            setCurrentConversationId(newConvId);
          }
        }

        // Add or update sidebar title if authenticated user
        if (user && data.suggestedTitle && newConvId) {
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === newConvId);
            if (exists) {
              return prev.map((c) =>
                c.id === newConvId ? { ...c, title: data.suggestedTitle } : c
              );
            }
            return [
              { id: newConvId, title: data.suggestedTitle, createdAt: new Date().toISOString() },
              ...prev,
            ];
          });
        }

        if (user) fetchLatestData(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast('error', errData.error || 'An error occurred while generating AI response.');
      }
    } catch (err) {
      console.warn('Chat API error:', err);
      showToast('error', 'Failed to connect to AI server.');
    } finally {
      setStreamingConvId(null);
    }
  };

  const handleRegenerate = async (assistantMsgId: string) => {
    if (streamingConvId !== null) return;

    const targetConvId = currentConversationId;
    if (!targetConvId) return;

    const assistantIdx = messages.findIndex((m) => m.id === assistantMsgId);
    if (assistantIdx === -1) return;

    let userPromptText = '';
    for (let i = assistantIdx - 1; i >= 0; i--) {
      if (messages[i].sender === 'user') {
        userPromptText = messages[i].content;
        break;
      }
    }

    if (!userPromptText) return;

    // Remove the old assistant message in-place if currently viewing targetConvId
    if (currentConvIdRef.current === targetConvId) {
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
    }
    setStreamingConvId(targetConvId);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userPromptText,
          model: selectedModel,
          conversationId: targetConvId,
          isRetry: true,
          assistantMessageId: assistantMsgId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newAiMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          content: data.content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          citations: data.citations,
        };

        if (currentConvIdRef.current === targetConvId) {
          setMessages((prev) => [...prev, newAiMsg]);
          if (data.suggestedFollowUps && Array.isArray(data.suggestedFollowUps)) {
            setSuggestedFollowUps(data.suggestedFollowUps);
          }
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast('error', errData.error || 'Failed to retry AI response.');
      }
    } catch (err) {
      console.warn('Regenerate API error:', err);
      showToast('error', 'Failed to connect to AI server.');
    } finally {
      setStreamingConvId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#212121] text-[#ececec]">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        documentCount={documents.length}
        onOpenUpload={() => setActiveTab('documents')}
        onNewChat={handleNewChat}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        user={user}
        onOpenAuthModal={handleOpenAuthModal}
        onLogout={handleLogout}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          onOpenUpload={() => setActiveTab('documents')}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onNavigateToDocuments={() => setActiveTab('documents')}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          isSyncing={isSyncing}
          onRefresh={() => fetchLatestData(false)}
          user={user}
          onOpenAuthModal={handleOpenAuthModal}
          onLogout={handleLogout}
        />

        <main className={`flex-1 min-h-0 ${activeTab === 'chat' ? 'overflow-hidden p-0 flex flex-col' : 'p-6 overflow-y-auto'}`}>
          {activeTab === 'dashboard' && (
            <OverviewStats
              documents={documents}
              setActiveTab={setActiveTab}
              onOpenUpload={() => setActiveTab('documents')}
              user={user}
              onOpenAuthModal={handleOpenAuthModal}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentManager
              documents={documents}
              onUploadDocument={handleUploadDocument}
              onDeleteDocument={handleDeleteDocument}
              searchQuery={searchQuery}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'chat' && (
            <ChatInterface
              messages={messages}
              onSendMessage={handleSendMessage}
              onRegenerate={handleRegenerate}
              isStreaming={isCurrentChatStreaming}
              onShowToast={showToast}
              documents={documents}
              suggestedFollowUps={suggestedFollowUps}
              onUploadDocument={handleUploadDocument}
              selectedModel={selectedModel}
            />
          )}

          {activeTab === 'graph' && (
            <KnowledgeGraph
              documents={documents}
              user={user}
              onOpenAuthModal={handleOpenAuthModal}
            />
          )}

          {activeTab === 'analytics' && (
            <RagAnalytics
              documents={documents}
              user={user}
              onOpenAuthModal={handleOpenAuthModal}
            />
          )}
        </main>

      </div>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalInitialMode}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        onShowToast={showToast}
      />

      {/* Global Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
