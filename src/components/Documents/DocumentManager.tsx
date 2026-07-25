'use client';

import React, { useState, useRef, useEffect } from 'react';
import { DocumentItem } from '@/types';
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  CheckCircle2,
  Loader2,
  X,
  Copy,
  Check,
  Plus,
  Search,
  Globe,
} from 'lucide-react';

import { formatDate } from '@/lib/utils';

interface DocumentChunkItem {
  id: string;
  content: string;
  pageNumber: number;
  createdAt: string;
}

interface DocumentManagerProps {
  documents: DocumentItem[];
  onUploadDocument: (file: File) => Promise<DocumentItem | null> | void;
  onDeleteDocument: (id: string) => void;
  searchQuery: string;
  onShowToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  documents,
  onUploadDocument,
  onDeleteDocument,
  searchQuery,
  onShowToast,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<DocumentItem | null>(null);
  const [docChunks, setDocChunks] = useState<DocumentChunkItem[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [copiedChunkId, setCopiedChunkId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]); // tracks filenames currently uploading
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef<number>(0);

  // Fetch real document chunks from Neon DB when preview modal opens
  useEffect(() => {
    if (!selectedDocForPreview) {
      setDocChunks([]);
      return;
    }

    const docId = selectedDocForPreview.id;

    async function fetchChunks() {
      setIsLoadingChunks(true);
      try {
        const res = await fetch(`/api/documents/${docId}/chunks`);
        if (res.ok) {
          const data = await res.json();
          if (data.chunks) {
            setDocChunks(data.chunks);
          }
        }
      } catch (err) {
        console.warn('Could not fetch real chunks from Neon DB:', err);
      } finally {
        setIsLoadingChunks(false);
      }
    }

    fetchChunks();
  }, [selectedDocForPreview]);

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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (const file of Array.from(e.dataTransfer.files)) {
        setUploadingFiles((prev) => [...prev, file.name]);
        try {
          await onUploadDocument(file);
        } finally {
          setUploadingFiles((prev) => prev.filter((n) => n !== file.name));
        }
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (const file of Array.from(e.target.files)) {
        setUploadingFiles((prev) => [...prev, file.name]);
        try {
          await onUploadDocument(file);
        } finally {
          setUploadingFiles((prev) => prev.filter((n) => n !== file.name));
        }
      }
      e.target.value = '';
    }
  };

  const handleDelete = (id: string, title: string) => {
    onDeleteDocument(id);
  };

  const handleCopyChunkText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChunkId(id);
    onShowToast('success', 'Chunk text copied!');
    setTimeout(() => setCopiedChunkId(null), 2000);
  };

  // Combine header global search + local search bar
  const activeQuery = localSearch || searchQuery;

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      !activeQuery ||
      doc.title.toLowerCase().includes(activeQuery.toLowerCase()) ||
      doc.fileType.toLowerCase().includes(activeQuery.toLowerCase());
    const matchesFilter =
      filterType === 'ALL' || doc.fileType.toUpperCase() === filterType;
    return matchesSearch && matchesFilter;
  });

  // Highlight matched substring in text
  const highlight = (text: string, query: string) => {
    if (!query) return <span>{text}</span>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <span>{text}</span>;
    return (
      <span>
        {text.slice(0, idx)}
        <mark className="bg-amber-400/30 text-amber-200 rounded px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </span>
    );
  };

  const [inputUrl, setInputUrl] = useState('');
  const [ingestingUrl, setIngestingUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');

  const handleUrlIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl || !inputUrl.startsWith('http')) {
      onShowToast('error', 'Please enter a valid HTTP or HTTPS URL.');
      return;
    }

    setIngestingUrl(true);
    try {
      const res = await fetch('/api/documents/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        onShowToast('success', `Web page "${data.title}" ingested & vectorized (${data.chunkCount} chunks)!`);
        setInputUrl('');
        // Trigger window reload or refetch documents if available
        window.location.reload();
      } else {
        const err = await res.json();
        onShowToast('error', err.error || 'Failed to ingest URL');
      }
    } catch (err) {
      onShowToast('error', 'Network error while ingesting URL.');
    } finally {
      setIngestingUrl(false);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative space-y-6 max-w-4xl mx-auto px-4 min-h-[calc(100vh-8rem)]"
    >
      {/* Full Container Drag & Drop Overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-[#171717]/90 backdrop-blur-md z-40 flex flex-col items-center justify-center border-2 border-dashed border-indigo-500 rounded-3xl m-1 pointer-events-none transition-all animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mb-3">
            <Upload className="w-8 h-8 text-indigo-400 animate-bounce" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Drop files here to upload</h3>
          <p className="text-xs text-zinc-400 font-mono">
            PDF, TXT, Markdown, Image (OCR), or Audio will be uploaded & indexed automatically
          </p>
        </div>
      )}

      {/* Title + Search Bar Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#ececec]">Document & Knowledge Base</h2>
          <p className="text-xs text-[#b4b4b4] mt-0.5">
            Multi-modal docs, PDFs, images, audio, & web URLs vectorized into Neon PostgreSQL (pgvector).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Inline Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8e8e93] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search documents..."
              className="pl-8 pr-8 py-1.5 bg-[#2f2f2f] border border-[#383838] rounded-xl text-xs text-[#ececec] placeholder-[#8e8e93] focus:outline-none focus:ring-1 focus:ring-zinc-600 w-48 transition-all"
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8e8e93] hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs: File Upload vs URL Web Page Ingestion */}
      <div className="flex items-center gap-2 border-b border-[#383838] pb-1">
        <button
          onClick={() => setActiveTab('upload')}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'upload' ? 'bg-[#383838] text-white' : 'text-[#b4b4b4] hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Files (PDF, Image, Audio, MD)</span>
        </button>
        <button
          onClick={() => setActiveTab('url')}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'url' ? 'bg-[#383838] text-cyan-300' : 'text-[#b4b4b4] hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Ingest Web Page URL</span>
        </button>
      </div>

      {activeTab === 'upload' ? (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="bg-[#2f2f2f] hover:bg-[#353535] rounded-2xl p-6 transition-all cursor-pointer text-center border border-[#383838]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp,.mp3,.wav,.m4a"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-2">
            <Upload className="w-6 h-6 text-[#b4b4b4]" />
            <p className="text-xs font-medium text-[#ececec]">
              Drag & drop PDF, Markdown, TXT, Image (OCR), or Audio files here
            </p>
            <p className="text-[11px] text-[#8e8e93]">
              Multi-modal chunking & embedding indexed into Neon DB pgvector
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleUrlIngest} className="bg-[#2f2f2f] rounded-2xl p-5 space-y-3 border border-[#383838]">
          <p className="text-xs font-semibold text-slate-200">Enter Web Page / Article URL to Scrape & Ingest:</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://example.com/article-or-documentation"
              className="flex-1 px-3 py-2 bg-[#1e1e1e] border border-[#383838] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              required
            />
            <button
              type="submit"
              disabled={ingestingUrl}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {ingestingUrl ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  <span>Ingest Page</span>
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-[#8e8e93]">
            Web content will be extracted, chunked, vectorized, and made searchable in RAG Chat.
          </p>
        </form>
      )}


      {/* Document Table Container */}
      <div className="bg-[#2f2f2f] rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-[#ececec]">Documents ({filteredDocs.length})</span>
          <div className="flex items-center gap-1">
            {['ALL', 'PDF', 'MARKDOWN', 'TXT'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                  filterType === type ? 'bg-[#383838] text-white' : 'text-[#b4b4b4] hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#383838] text-[#8e8e93]">
                <th className="pb-2 px-2 font-normal">NAME</th>
                <th className="pb-2 px-2 font-normal">TYPE</th>
                <th className="pb-2 px-2 font-normal">CHUNKS</th>
                <th className="pb-2 px-2 font-normal">STATUS</th>
                <th className="pb-2 px-2 font-normal">DATE</th>
                <th className="pb-2 px-2 font-normal text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#383838]">
              {/* Optimistic uploading rows — shown only if not already in documents array */}
              {uploadingFiles
                .filter((fname) => !documents.some((d) => d.title === fname))
                .map((fname) => (
                  <tr key={`uploading-${fname}`} className="bg-amber-500/5 hover:bg-amber-500/10 transition-colors animate-pulse border-b border-amber-500/20">
                    <td className="py-3 px-2 font-medium text-[#ececec] flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                      <span className="truncate max-w-[220px] text-amber-200 font-medium">{fname}</span>
                    </td>
                    <td className="py-3 px-2 text-amber-300/80 font-mono text-[11px]">Processing</td>
                    <td className="py-3 px-2 text-amber-300/80 font-mono">Indexing…</td>
                    <td className="py-3 px-2">
                      <span className="text-amber-400 font-medium text-[11px] flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 w-fit">
                        <Loader2 className="w-3 h-3 animate-spin text-amber-400" /> Vectorizing PDF…
                      </span>
                    </td>
                    <td className="py-3 px-2 text-amber-400/60 font-mono text-[11px]">Just now</td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-xs text-amber-400/80 italic font-mono">Processing…</span>
                    </td>
                  </tr>
                ))}

              {filteredDocs.length === 0 && uploadingFiles.filter((fname) => !documents.some((d) => d.title === fname)).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[#8e8e93] text-xs space-y-1">
                    {activeQuery ? (
                      <>
                        <p className="text-sm font-medium text-zinc-400">No documents matching <span className="text-amber-300">&ldquo;{activeQuery}&rdquo;</span></p>
                        <p>Try different keywords or clear the search filter.</p>
                        <button
                          onClick={() => { setLocalSearch(''); }}
                          className="mt-2 text-xs px-3 py-1 bg-[#383838] rounded-lg hover:bg-[#424242] text-zinc-300 transition-colors"
                        >
                          Clear search
                        </button>
                      </>
                    ) : (
                      <p>No documents uploaded yet. Upload PDF, TXT, or Markdown files above.</p>
                    )}
                  </td>
                </tr>
              ) : (
                <>
                  {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#383838]/50 transition-colors">
                    <td className="py-3 px-2 font-medium text-[#ececec] flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#8e8e93] shrink-0" />
                      <span className="truncate max-w-[220px]">
                        {highlight(doc.title, activeQuery)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-[#b4b4b4] font-mono text-[11px]">{doc.fileType}</td>
                    <td className="py-3 px-2 text-[#b4b4b4] font-mono">{doc.chunksCount} chunks</td>
                    <td className="py-3 px-2">
                      {doc.status === 'READY' ? (
                        <span className="text-emerald-400 font-medium text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Ready
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium text-[11px] flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Vectorizing
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-[#8e8e93] font-mono text-[11px]">{formatDate(doc.createdAt)}</td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedDocForPreview(doc)}
                          className="p-1.5 rounded-lg hover:bg-[#424242] text-[#b4b4b4] hover:text-white"
                          title="Inspect chunks"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id, doc.title)}
                          className="p-1.5 rounded-lg hover:bg-[#424242] text-rose-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))}
                </>
              )}

            </tbody>
          </table>
        </div>
      </div>

      {/* Real Chunks Inspector Modal */}
      {selectedDocForPreview && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#212121] text-[#ececec] w-full max-w-xl rounded-2xl p-5 space-y-4 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#383838] pb-3">
              <div>
                <h4 className="font-semibold text-sm">{selectedDocForPreview.title}</h4>
                <p className="text-[11px] text-[#8e8e93] font-mono">
                  {selectedDocForPreview.chunksCount} total vector chunks in Neon DB
                </p>
              </div>
              <button
                onClick={() => setSelectedDocForPreview(null)}
                className="p-1 rounded-lg text-[#8e8e93] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 flex-1 text-xs">
              {isLoadingChunks ? (
                <div className="py-12 flex items-center justify-center gap-2 text-[#8e8e93] font-mono">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Loading real chunks from Neon PostgreSQL...</span>
                </div>
              ) : docChunks.length === 0 ? (
                <div className="py-12 text-center text-[#8e8e93]">
                  No chunks found for this document.
                </div>
              ) : (
                docChunks.map((chunk, index) => (
                  <div key={chunk.id || index} className="p-3.5 rounded-xl bg-[#2f2f2f] space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#8e8e93] font-mono">
                      <span>Chunk #{index + 1} (Page {chunk.pageNumber || 1})</span>
                      <button
                        onClick={() => handleCopyChunkText(chunk.id, chunk.content)}
                        className="flex items-center gap-1 text-[#b4b4b4] hover:text-white"
                      >
                        {copiedChunkId === chunk.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedChunkId === chunk.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="text-[#ececec] leading-relaxed select-text font-sans">{chunk.content}</p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-[#383838] flex justify-end">
              <button
                onClick={() => setSelectedDocForPreview(null)}
                className="px-4 py-1.5 rounded-xl bg-[#2f2f2f] text-white hover:bg-[#383838] text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
