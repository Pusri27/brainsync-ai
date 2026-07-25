import React, { useEffect, useState, useRef } from 'react';
import { Network, RefreshCw, ZoomIn, ZoomOut, Layers, FileText, Sparkles, Lock, LogIn } from 'lucide-react';
import { DocumentItem } from '@/types';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  category: string;
  val: number;
  x?: number;
  y?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  similarity: number;
  label?: string;
}

interface KnowledgeGraphProps {
  documents?: DocumentItem[];
  user?: { id: string; name: string; email: string } | null;
  onOpenAuthModal?: (mode?: 'login' | 'register') => void;
}

export default function KnowledgeGraph({ documents = [], user, onOpenAuthModal }: KnowledgeGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/graph');
      if (res.ok) {
        const data = await res.json();
        const rawNodes: GraphNode[] = data.nodes || [];
        const rawEdges: GraphEdge[] = data.edges || [];

        const width = 850;
        const height = 500;
        const radius = Math.min(width, height) * 0.35;
        const center = { x: width / 2, y: height / 2 };

        const positionedNodes = rawNodes.map((node, i) => {
          const angle = (i / rawNodes.length) * 2 * Math.PI;
          return {
            ...node,
            x: center.x + radius * Math.cos(angle) + (Math.random() * 50 - 25),
            y: center.y + radius * Math.sin(angle) + (Math.random() * 50 - 25),
          };
        });

        setNodes(positionedNodes);
        setEdges(rawEdges);
      }
    } catch (err) {
      console.warn('Failed to load graph data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, [user]);

  // Render 2D Canvas Graph matching #1e1e1e grey background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Draw Solid Grey Background matching app theme (#1e1e1e)
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);

    // Subtle Grid Lines
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.save();
    ctx.scale(zoom, zoom);

    // 2. Draw Edges (Links)
    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      if (sourceNode?.x && sourceNode?.y && targetNode?.x && targetNode?.y) {
        ctx.beginPath();
        ctx.moveTo(sourceNode.x, sourceNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);

        const edgeAlpha = Math.min(0.85, Math.max(0.2, edge.similarity * 0.7));
        ctx.strokeStyle = `rgba(99, 102, 241, ${edgeAlpha})`;
        ctx.lineWidth = Math.max(1.2, edge.similarity * 2.8);
        ctx.stroke();

        // Edge label (similarity percentage)
        if (edge.similarity > 0.78) {
          const midX = (sourceNode.x + targetNode.x) / 2;
          const midY = (sourceNode.y + targetNode.y) / 2;
          ctx.font = '500 10px Inter, sans-serif';
          ctx.fillStyle = '#8e8e93';
          ctx.fillText(`${Math.round(edge.similarity * 100)}%`, midX, midY);
        }
      }
    });

    // 3. Draw Nodes
    nodes.forEach((node) => {
      if (!node.x || !node.y) return;
      const isSelected = selectedNode?.id === node.id;
      const radius = (node.val || 14) + (isSelected ? 4 : 0);

      let nodeColor = '#6366f1';
      let glowColor = 'rgba(99, 102, 241, 0.35)';

      if (node.category === 'web') {
        nodeColor = '#06b6d4';
        glowColor = 'rgba(6, 182, 212, 0.35)';
      } else if (node.category === 'image') {
        nodeColor = '#ec4899';
        glowColor = 'rgba(236, 72, 153, 0.35)';
      } else if (node.category === 'audio') {
        nodeColor = '#f59e0b';
        glowColor = 'rgba(245, 158, 11, 0.35)';
      }

      // Outer Ring Effect
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + (isSelected ? 8 : 4), 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.3)' : glowColor;
      ctx.fill();

      // Node Body
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor;
      ctx.fill();

      ctx.strokeStyle = isSelected ? '#ffffff' : '#383838';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.stroke();

      // Label Text
      ctx.font = isSelected ? '600 12px Inter, sans-serif' : '500 11px Inter, sans-serif';
      ctx.fillStyle = isSelected ? '#ffffff' : '#ececec';
      ctx.textAlign = 'center';

      const shortTitle = node.label.length > 18 ? node.label.substring(0, 16) + '...' : node.label;
      ctx.fillText(shortTitle, node.x, node.y + radius + 15);
    });

    ctx.restore();
  }, [nodes, edges, zoom, selectedNode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoom;
    const clickY = (e.clientY - rect.top) / zoom;

    const clicked = nodes.find((n) => {
      if (!n.x || !n.y) return false;
      const dist = Math.sqrt((n.x - clickX) ** 2 + (n.y - clickY) ** 2);
      return dist <= (n.val || 14) + 6;
    });

    setSelectedNode(clicked || null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#ececec] flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-400" />
            Knowledge Network Graph
          </h2>
          <p className="text-xs text-[#b4b4b4] mt-0.5">
            Interactive semantic map displaying relationships & vector similarity links across your RAG knowledge base.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#2f2f2f] border border-[#383838] rounded-xl p-1">
            <button
              onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
              className="p-1.5 hover:bg-[#383838] rounded-lg text-[#b4b4b4] hover:text-white transition text-xs"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
              className="p-1.5 hover:bg-[#383838] rounded-lg text-[#b4b4b4] hover:text-white transition text-xs"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={fetchGraphData}
            disabled={loading}
            className="px-3.5 py-2 bg-[#2f2f2f] hover:bg-[#383838] border border-[#383838] text-[#ececec] rounded-xl transition text-xs flex items-center gap-1.5 font-medium cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Container Card matching #2f2f2f grey theme */}
      <div className="bg-[#2f2f2f] rounded-2xl p-5 border border-[#383838] space-y-4 shadow-md">
        {/* Legend Bar */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#b4b4b4] bg-[#1e1e1e] p-3 rounded-xl border border-[#383838]">
          <span className="font-semibold text-[#ececec] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Legend:
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" /> Document / PDF
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-cyan-500 inline-block" /> Web / URL
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-pink-500 inline-block" /> Image (OCR)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Audio Transcript
          </span>
        </div>

        {/* Canvas View */}
        <div className="relative overflow-hidden rounded-xl border border-[#383838] bg-[#1e1e1e] flex justify-center items-center">
          {loading ? (
            <div className="h-[460px] w-full flex flex-col items-center justify-center gap-3 text-[#8e8e93]">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs font-mono text-zinc-400">Loading Knowledge Network Graph...</p>
            </div>
          ) : !user ? (
            <div className="h-[460px] w-full flex flex-col items-center justify-center gap-3.5 text-[#8e8e93] px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-1">
                <Lock className="w-8 h-8 text-amber-400" />
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-semibold font-mono">
                Guest Mode (Not Signed In)
              </span>
              <h3 className="text-base font-bold text-white">Knowledge Network Graph Locked</h3>
              <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                You are currently in Guest Mode. Please Sign In or Register for unlimited document uploads and RAG vector cluster graph visualization.
              </p>
              <button
                type="button"
                onClick={() => onOpenAuthModal?.('login')}
                className="mt-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In / Register Now</span>
              </button>
            </div>
          ) : nodes.length === 0 ? (
            <div className="h-[460px] w-full flex flex-col items-center justify-center gap-3 text-[#8e8e93] px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-1">
                <Layers className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-white">No Uploaded Documents Yet</h3>
              <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                Please upload documents or attach files in Chat to view the vector relationship graph.
              </p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={850}
              height={480}
              onClick={handleCanvasClick}
              className="w-full h-[480px] cursor-pointer"
            />
          )}

          {/* Selected Node Details */}
          {selectedNode && (
            <div className="absolute bottom-4 left-4 right-4 sm:right-auto max-w-md bg-[#2f2f2f] border border-[#383838] rounded-2xl p-4 shadow-xl text-xs space-y-2">
              <div className="flex justify-between items-center font-bold text-[#ececec]">
                <span className="truncate flex items-center gap-2 text-sm text-indigo-300">
                  <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                  {selectedNode.label}
                </span>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-[#8e8e93] hover:text-white p-1 rounded-lg hover:bg-[#383838] transition"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#383838] text-[11px]">
                <div>
                  <span className="text-[#8e8e93]">Type:</span>{' '}
                  <span className="font-semibold text-[#ececec]">{selectedNode.type}</span>
                </div>
                <div>
                  <span className="text-[#8e8e93]">Category:</span>{' '}
                  <span className="font-semibold text-cyan-400 capitalize">{selectedNode.category}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
