'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, DocumentChunk, DocumentItem } from '@/types';
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Paperclip,
  ArrowUp,
  Brain,
  FileText,
  Filter,
  Mic,
  MicOff,
  Globe,
  X,
  Loader2,
  Search,
  Bot,
  FolderOpen,
  Link,
  Volume2,
  PenLine,
  AlertCircle,
  Database,
  Cpu,
} from 'lucide-react';

import { SourceViewerModal } from './SourceViewerModal';
import { MarkdownRenderer } from './MarkdownRenderer';
import { SearchableSourceSelect, SourceOption } from './SearchableSourceSelect';

function detectLanguage(text: string): 'id' | 'en' {
  if (!text) return 'id';
  const lower = text.toLowerCase();

  const idWords = [
    'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'atau', 'pada', 'bisa',
    'juga', 'dengan', 'untuk', 'apa', 'mengapa', 'bagaimana', 'siapa', 'kapan',
    'dimana', 'tolong', 'buatkan', 'jelaskan', 'rangkum', 'apakah', 'saya', 'kami',
    'kita', 'mereka', 'anda', 'kamu', 'tidak', 'ada', 'akan', 'sudah', 'telah',
    'halo', 'hai', 'terima', 'kasih'
  ];

  const enWords = [
    'the', 'is', 'are', 'at', 'which', 'on', 'and', 'a', 'to', 'in', 'that', 'have',
    'it', 'for', 'not', 'with', 'he', 'as', 'you', 'do', 'this',
    'but', 'by', 'from', 'they', 'we', 'say', 'she', 'or', 'an',
    'will', 'my', 'all', 'would', 'there', 'their', 'what', 'so', 'up',
    'out', 'if', 'about', 'who', 'get', 'go', 'me', 'explain', 'summarize',
    'please', 'how', 'why', 'create', 'make', 'write', 'generate', 'hello', 'hi', 'thanks'
  ];

  const words = lower.match(/\b[a-z]{2,}\b/g) || [];
  let idCount = 0;
  let enCount = 0;

  for (const w of words) {
    if (idWords.includes(w)) idCount++;
    if (enWords.includes(w)) enCount++;
  }

  if (enCount > idCount) return 'en';
  return 'id';
}

export interface AttachedFileItem {
  id: string;
  name: string;
  size: string;
  file: File;
  status: 'uploading' | 'ready' | 'error';
  docId?: string;
}

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, selectedDocumentId?: string | string[], urls?: string[], webSearch?: boolean) => void;
  onRegenerate: (assistantMessageId: string) => void;
  isStreaming: boolean;
  onShowToast: (type: 'success' | 'error' | 'info', msg: string) => void;
  documents: DocumentItem[];
  suggestedFollowUps?: string[];
  onUploadDocument?: (file: File) => Promise<DocumentItem | null>;
  selectedModel?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  onRegenerate,
  isStreaming,
  onShowToast,
  documents,
  suggestedFollowUps = [],
  onUploadDocument,
  selectedModel = 'Gemini AI Model',
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedCitation, setSelectedCitation] = useState<DocumentChunk | null>(null);
  const [selectedDocSources, setSelectedDocSources] = useState<string[]>(['ALL']);

  const [isWebSearch, setIsWebSearch] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [isListening, setIsListening] = useState<boolean>(false);
  const [detectedUrls, setDetectedUrls] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileItem[]>([]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [thinkingStep, setThinkingStep] = useState<number>(0);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [retryingMsgId, setRetryingMsgId] = useState<string | null>(null);

  useEffect(() => {
    if (!isStreaming) {
      setThinkingStep(0);
      setRetryingMsgId(null);
      return;
    }
    const interval = setInterval(() => {
      setThinkingStep((prev) => (prev + 1) % 3);
    }, 1600);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const handleRegenerateClick = (msgId: string) => {
    setRetryingMsgId(msgId);
    onRegenerate(msgId);
  };

  const processFiles = async (files: FileList | File[]) => {
    if (!onUploadDocument) return;
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    for (const file of fileList) {
      const tempId = `attached-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const fileSizeStr = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
      const newItem: AttachedFileItem = {
        id: tempId,
        name: file.name,
        size: fileSizeStr,
        file,
        status: 'uploading',
      };

      setAttachedFiles((prev) => [...prev, newItem]);

      try {
        const uploadedDoc = await onUploadDocument(file);
        if (uploadedDoc && uploadedDoc.id) {
          setAttachedFiles((prev) =>
            prev.map((item) =>
              item.id === tempId ? { ...item, status: 'ready', docId: uploadedDoc.id } : item
            )
          );
          setSelectedDocSources((prev) => (prev.includes('NONE') ? ['ALL'] : prev));
        } else {
          setAttachedFiles((prev) =>
            prev.map((item) => (item.id === tempId ? { ...item, status: 'error' } : item))
          );
        }
      } catch (err) {
        setAttachedFiles((prev) =>
          prev.map((item) => (item.id === tempId ? { ...item, status: 'error' } : item))
        );
      }
    }
  };

  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Extract all URLs from a given text string
  const extractUrls = (text: string): string[] => {
    const urlRegex = /https?:\/\/[^\s<>"']+/gi;
    const matches = text.match(urlRegex) || [];
    return [...new Set(matches)];
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    const urls = extractUrls(val);
    setDetectedUrls(urls);
  };

  const removeUrl = (urlToRemove: string) => {
    setDetectedUrls((prev) => prev.filter((u) => u !== urlToRemove));
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onShowToast('error', 'Your browser does not support Voice-to-Text.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      onShowToast('error', 'Microphone permission denied. Enable microphone access in browser settings.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        onShowToast('info', 'Listening... Speak into your microphone.');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputText(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'network') {
          onShowToast(
            'error',
            'Google Speech server connection failed. Check your internet connection and try again.'
          );
        } else if (event.error === 'not-allowed') {
          onShowToast('error', 'Microphone permission denied by browser.');
        } else if (event.error !== 'no-speech') {
          onShowToast('error', `Speech recognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Failed to start SpeechRecognition:', err);
      setIsListening(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const hasUploading = attachedFiles.some((f) => f.status === 'uploading');
    if (hasUploading) {
      onShowToast('info', 'Please wait until document indexing finishes...');
      return;
    }

    const readyDocIds = attachedFiles
      .filter((f) => f.status === 'ready' && f.docId)
      .map((f) => f.docId as string);

    let textToSend = inputText.trim();
    if (!textToSend && readyDocIds.length > 0) {
      const fileNames = attachedFiles.map((f) => f.name).join(', ');
      textToSend = `Please analyze and summarize the attached document(s): ${fileNames}`;
    }

    if (!textToSend || isStreaming) return;

    let effectiveSources = selectedDocSources;
    if (readyDocIds.length > 0) {
      if (selectedDocSources.includes('NONE')) {
        effectiveSources = readyDocIds;
      } else if (!selectedDocSources.includes('ALL')) {
        effectiveSources = Array.from(new Set([...selectedDocSources, ...readyDocIds]));
      }
    }

    onSendMessage(
      textToSend,
      effectiveSources,
      detectedUrls.length > 0 ? detectedUrls : undefined,
      isWebSearch
    );

    setInputText('');
    setDetectedUrls([]);
    setAttachedFiles([]);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    onShowToast('success', 'Text copied successfully!');
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleFeedback = (id: string, type: 'up' | 'down') => {
    setFeedback((prev) => ({ ...prev, [id]: type }));
    onShowToast('success', 'Feedback saved!');
  };

  const samplePrompts = [
    'Summarize main points of my document',
    'Search latest updates on AI technology',
    'Draft a quick executive summary',
  ];

  const readyDocuments = documents.filter((d) => d.status === 'READY');

  const sourceOptions: SourceOption[] = [
    { value: 'NONE', label: 'AI Only', icon: Bot, description: 'Pure AI model knowledge' },
    { value: 'ALL', label: `All Docs (${readyDocuments.length})`, icon: FolderOpen, description: 'All knowledge base documents' },
    ...readyDocuments.map((doc) => ({
      value: doc.id,
      label: doc.title,
      icon: FileText,
      description: doc.fileType,
    })),
  ];


  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col h-full w-full relative"
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-indigo-950/85 backdrop-blur-md border-2 border-dashed border-indigo-400 rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150 pointer-events-none">
          <Paperclip className="w-12 h-12 text-indigo-400 animate-bounce mb-3" />
          <h3 className="text-lg font-bold text-white">Drop documents here to attach</h3>
          <p className="text-sm text-indigo-200 mt-1">Files will automatically be indexed into vector store and saved to your Documents list.</p>
        </div>
      )}
      {/* Top Controls Bar */}
      <div className="w-full border-b border-[#2a2a2e]/80">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Document Source — Searchable Dropdown */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <Filter className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <SearchableSourceSelect
                value={selectedDocSources}
                onChange={setSelectedDocSources}
                options={sourceOptions}
              />
            </div>


            {/* Web Search Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsWebSearch((v) => !v);
                if (!isWebSearch) onShowToast('info', 'Web search active — AI will search the internet.');
              }}
              title={isWebSearch ? 'Disable web search' : 'Enable web search (DuckDuckGo)'}
              className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded-lg border transition-all ${
                isWebSearch
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 font-semibold shadow-sm'
                  : 'bg-[#29292e] border-[#38383e] text-zinc-400 hover:text-white hover:border-zinc-500'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isWebSearch ? 'Web Active' : 'Search Web'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages Scroll Feed — Scrollbar is at the far right edge of the workspace */}
      <div className="flex-1 w-full overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 space-y-7 pt-3 pb-6">
        {messages.length === 0 ? (
          /* Empty Chat — Feature Showcase */
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 my-auto py-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2e2e34] to-[#1f1f23] flex items-center justify-center border border-white/10 shadow-xl">
              <Brain className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">BrainSync AI</h2>
              <p className="text-sm text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Smart assistant for document RAG, URL analysis, and web search.
              </p>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm text-left">
              {[
                {
                  icon: <FileText className="w-4 h-4 text-indigo-400" />,
                  title: 'Document RAG',
                  desc: 'Ask questions directly from PDF/TXT files',
                  bg: 'bg-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/40',
                },
                {
                  icon: <Search className="w-4 h-4 text-sky-400" />,
                  title: 'Web Search',
                  desc: 'Real-time information from the internet',
                  bg: 'bg-sky-500/5 border-sky-500/20 hover:border-sky-500/40',
                },
                {
                  icon: <Link className="w-4 h-4 text-emerald-400" />,
                  title: 'URL Analysis',
                  desc: 'Paste article links directly in chat',
                  bg: 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40',
                },
                {
                  icon: <Volume2 className="w-4 h-4 text-rose-400" />,
                  title: 'Voice Input',
                  desc: 'Automatic speech-to-text dictation',
                  bg: 'bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40',
                },
                {
                  icon: <Bot className="w-4 h-4 text-amber-400" />,
                  title: 'Pure AI Mode',
                  desc: 'Use model inherent knowledge',
                  bg: 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40',
                },
                {
                  icon: <PenLine className="w-4 h-4 text-purple-400" />,
                  title: 'Rich Editor',
                  desc: 'Write rich text notes on Canvas',
                  bg: 'bg-purple-500/5 border-purple-500/20 hover:border-purple-500/40',
                },
              ].map((f, i) => (
                <div key={i} className={`p-3.5 rounded-xl border ${f.bg} transition-all`}>
                  <div className="flex items-center gap-2 mb-1">
                    {f.icon}
                    <span className="text-xs font-semibold text-white">{f.title}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={msg.id} className="space-y-2">
                {isUser ? (
                  /* User Message Bubble */
                  <div className="flex justify-end">
                    <div className="bg-[#2d2d34] text-zinc-100 rounded-2xl rounded-tr-xs px-4 py-3 text-[15px] leading-relaxed font-sans border border-white/5 shadow-sm max-w-[85%]">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  /* AI Message Block */
                  <div className="space-y-3.5 pl-1">
                    {/* Assistant Header Avatar */}
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                      <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-zinc-200">BrainSync AI</span>
                    </div>

                    {/* Sources Pills */}
                    {msg.citations && msg.citations.length > 0 && (() => {
                      const uniqueCitations: typeof msg.citations = [];
                      const seenTitles = new Set<string>();

                      msg.citations.forEach((cite) => {
                        const key = cite.url || cite.documentTitle;
                        if (!seenTitles.has(key)) {
                          seenTitles.add(key);
                          uniqueCitations.push(cite);
                        }
                      });

                      return (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-zinc-400 font-mono mr-1">
                            Sources ({uniqueCitations.length}):
                          </span>
                          {uniqueCitations.map((cite, idx) => {
                            const isWeb = cite.sourceType === 'web' || cite.sourceType === 'url' || Boolean(cite.url);
                            if (isWeb && cite.url) {
                              return (
                                <a
                                  key={cite.id || idx}
                                  href={cite.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-mono transition-all group"
                                  title={cite.url}
                                >
                                  <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                  <span className="truncate max-w-[180px] font-medium">{cite.documentTitle}</span>
                                  <span className="opacity-60 text-[10px] group-hover:translate-x-0.5 transition-transform">↗</span>
                                </a>
                              );
                            }
                            return (
                              <button
                                key={cite.id || idx}
                                type="button"
                                onClick={() => setSelectedCitation(cite)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-300 text-xs font-mono transition-all cursor-pointer"
                                title={cite.documentTitle}
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="truncate max-w-[160px] font-medium">{cite.documentTitle}</span>

                                {cite.similarityScore && (
                                  <span className="opacity-70">({Math.round(cite.similarityScore * 100)}%)</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Rich Markdown Response Body */}
                    <div className="bg-[#1c1c1f]/40 p-4 rounded-2xl border border-white/5 shadow-sm">
                      <MarkdownRenderer
                        content={msg.content}
                        citations={msg.citations}
                        onSelectCitation={setSelectedCitation}
                      />
                    </div>

                    {/* Action Toolbar */}
                    <div className="flex items-center gap-1 text-xs text-zinc-400 pt-0.5">
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                        title="Copy response"
                      >
                        {copiedMsgId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="font-mono text-[11px]">Copy</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleRegenerateClick(msg.id)}
                        disabled={isStreaming}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                        title="Retry this AI response"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isStreaming && retryingMsgId === msg.id ? 'animate-spin text-amber-400' : ''}`} />
                        <span className="font-mono text-[11px]">Retry</span>
                      </button>
                      <div className="w-px h-3 bg-zinc-700/60 mx-1" />
                      <button
                        onClick={() => handleFeedback(msg.id, 'up')}
                        className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${
                          feedback[msg.id] === 'up' ? 'text-emerald-400' : 'hover:text-white'
                        }`}
                        title="Helpful"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, 'down')}
                        className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${
                          feedback[msg.id] === 'down' ? 'text-rose-400' : 'hover:text-white'
                        }`}
                        title="Not helpful"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Animated AI Model Thinking Card */}
        {isStreaming && (() => {
          const lastUserMsg = [...messages].reverse().find((m) => m.sender === 'user');
          const isEn = detectLanguage(lastUserMsg?.content || inputText) === 'en';

          return (
            <div className="flex gap-3 text-sm animate-in fade-in slide-in-from-bottom-2 duration-200 py-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20 border border-white/20">
                <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
              </div>
              <div className="flex items-center">
                <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                  AI Thinking...
                </span>
              </div>
            </div>
          );
        })()}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Dynamic Context-Aware Follow-up Prompts */}
      {!isStreaming && (
        <div className="py-2 flex items-center gap-2 overflow-x-auto justify-center px-3 max-w-3xl mx-auto w-full custom-scrollbar">
          {(messages.length === 0
            ? samplePrompts
            : suggestedFollowUps && suggestedFollowUps.length > 0
            ? suggestedFollowUps
            : []
          ).map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSendMessage(prompt, selectedDocSources, undefined, isWebSearch)}

              className="text-xs px-3.5 py-2 rounded-xl bg-[#29292e] hover:bg-[#34343a] text-zinc-200 transition-all shrink-0 border border-white/10 hover:border-indigo-500/40 shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      )}

      {/* Capsule Input Form Container */}
      <div className="w-full">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-3 sm:px-4 pb-4 pt-1 space-y-2">
        {isListening && (
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-rose-300 bg-rose-500/15 border border-rose-500/30 py-1.5 px-3 rounded-xl animate-pulse">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <span className="font-medium">Listening to your voice...</span>
          </div>
        )}

        {isWebSearch && (
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-sky-300 bg-sky-500/10 border border-sky-500/25 py-1.5 px-3 rounded-xl">
            <Search className="w-3 h-3 shrink-0 text-sky-400" />
            <span>Web search active — Responses include online search results</span>
          </div>
        )}

        {/* URL Preview Chips */}
        {detectedUrls.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-xs text-zinc-400 font-mono shrink-0 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-indigo-400" /> Detected links:
            </span>

            {detectedUrls.map((url) => (
              <div
                key={url}
                className="flex items-center gap-1.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs px-2.5 py-1 rounded-full font-mono max-w-[220px]"
                title={url}
              >
                {isStreaming ? (
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                ) : (
                  <Globe className="w-3 h-3 shrink-0 text-indigo-400" />
                )}
                <span className="truncate">{getDomain(url)}</span>
                {!isStreaming && (
                  <button
                    type="button"
                    onClick={() => removeUrl(url)}
                    className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                    title="Remove URL"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Attached Files Preview Chips */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-xs text-zinc-400 font-mono shrink-0 flex items-center gap-1">
              <Paperclip className="w-3.5 h-3.5 text-indigo-400" /> Attached docs ({attachedFiles.length}):
            </span>

            {attachedFiles.map((fileItem) => (
              <div
                key={fileItem.id}
                className={`flex items-center gap-1.5 border text-xs px-2.5 py-1 rounded-full font-mono max-w-[240px] transition-all ${
                  fileItem.status === 'uploading'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : fileItem.status === 'ready'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                }`}
                title={`${fileItem.name} (${fileItem.size}) - ${
                  fileItem.status === 'ready'
                    ? 'Indexed & Saved to Documents'
                    : fileItem.status === 'uploading'
                    ? 'Indexing & Uploading to Neon DB...'
                    : 'Upload failed'
                }`}
              >
                <FileText className="w-3 h-3 shrink-0 text-indigo-400" />
                <span className="truncate max-w-[120px]">{fileItem.name}</span>
                <span className="text-[10px] opacity-75">({fileItem.size})</span>

                {fileItem.status === 'uploading' && (
                  <Loader2 className="w-3 h-3 animate-spin shrink-0 text-amber-400" />
                )}
                {fileItem.status === 'ready' && (
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                )}
                {fileItem.status === 'error' && (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                )}

                {!isStreaming && (
                  <button
                    type="button"
                    onClick={() => removeAttachedFile(fileItem.id)}
                    className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input Bar Container */}
        <div className={`bg-[#27272b] border border-white/10 rounded-2xl p-2.5 flex items-center gap-2 shadow-2xl transition-all ${
          isListening ? 'ring-2 ring-rose-500/50 bg-[#312326]' : 'focus-within:border-zinc-500/80 focus-within:ring-2 focus-within:ring-zinc-500/20'
        }`}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelectChange}
            accept=".pdf,.txt,.md,.doc,.docx,.png,.jpg,.jpeg,.mp3,.wav,.csv,.json"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Attach file to chat (Saved directly to Documents)"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Voice-to-Text Mic Button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
            title={isListening ? 'Stop Voice Recording' : 'Voice Input'}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={isListening ? 'Listening now...' : 'Ask a question, attach files, or paste URL...'}
            disabled={isStreaming}
            className="flex-1 bg-transparent px-2 text-[15px] text-zinc-100 placeholder-zinc-500 focus:outline-none disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={
              (!inputText.trim() && attachedFiles.filter((f) => f.status === 'ready').length === 0) ||
              isStreaming ||
              attachedFiles.some((f) => f.status === 'uploading')
            }
            className="w-8 h-8 rounded-xl bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow cursor-pointer"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
        </form>
      </div>

      {/* Citation Modal Inspector */}
      <SourceViewerModal
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
};
