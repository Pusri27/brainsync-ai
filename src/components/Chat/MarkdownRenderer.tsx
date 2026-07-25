'use client';

import React from 'react';

interface MarkdownRendererProps {
  content: string;
  citations?: Array<{ id: string; documentTitle: string; similarityScore: number }>;
  onSelectCitation?: (citation: any) => void;
}

// ─────────────────────────────────────────────
// Inline formatter: bold, italic, code, citation
// ─────────────────────────────────────────────
function formatInlineText(
  text: string,
  citations?: Array<any>,
  onSelectCitation?: (citation: any) => void
): React.ReactNode[] {
  const clean = text.replace(/^#+\s*/, '');

  // Tokens: **bold**, *italic*, `code`, [N] citation
  const parts = clean.split(/(\*\*[\s\S]*?\*\*|\*[^*\n]+\*|`[^`]+`|\[\d+\])/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={i} className="italic text-zinc-300 font-serif">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded-md bg-[#2d2d32] border border-[#3f3f46] text-emerald-300 font-mono text-[13px] inline-block my-0.5"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const citationMatch = part.match(/^\[(\d+)\]$/);
    if (citationMatch) {
      const citeIndex = parseInt(citationMatch[1], 10) - 1;
      const targetCite = citations && citations[citeIndex];
      return (
        <sup
          key={i}
          onClick={() => targetCite && onSelectCitation && onSelectCitation(targetCite)}
          className="citation-link inline-flex items-center justify-center font-mono text-[11px] font-semibold text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/30 rounded px-1.5 py-0.5 mx-0.5 cursor-pointer transition-all hover:scale-105"
          title={targetCite ? targetCite.documentTitle : 'Source citation'}
        >
          [{citationMatch[1]}]
        </sup>
      );
    }
    return part;
  });
}

// ─────────────────────────────────────────────
// Parse a GFM table block into header + rows
// ─────────────────────────────────────────────
function parseTable(lines: string[]): { headers: string[]; aligns: string[]; rows: string[][] } | null {
  if (lines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

  const headers = parseRow(lines[0]);

  // Separator row: must contain :--- or --- patterns
  const separatorRow = parseRow(lines[1]);
  if (!separatorRow.every((cell) => /^:?-+:?$/.test(cell.trim()))) return null;

  const aligns = separatorRow.map((cell) => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
    if (cell.endsWith(':')) return 'right';
    return 'left';
  });

  const rows = lines.slice(2).map(parseRow);

  return { headers, aligns, rows };
}

// ─────────────────────────────────────────────
// Main renderer — group lines into blocks first
// ─────────────────────────────────────────────
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  citations,
  onSelectCitation,
}) => {
  // Strip wrapping code fences the AI sometimes adds
  const cleaned = content.replace(/^```[a-z]*\n?/gm, '').replace(/\n?```$/gm, '');
  const rawLines = cleaned.split('\n');

  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // ── Skip empty lines ─────────────────────────────
    if (!trimmed) {
      i++;
      continue;
    }

    // ── Fenced code block (``` or ~~~) ───────────────
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const fence = trimmed.startsWith('```') ? '```' : '~~~';
      const lang = trimmed.replace(fence, '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].trim().startsWith(fence)) {
        codeLines.push(rawLines[i]);
        i++;
      }
      i++; // consume closing fence
      blocks.push(
        <div key={`code-${i}`} className="my-4 rounded-xl overflow-hidden border border-[#3f3f46]/60 shadow-lg bg-[#18181b]">
          {lang && (
            <div className="px-4 py-2 bg-[#27272a] text-xs font-mono text-zinc-400 border-b border-[#3f3f46]/40 flex items-center justify-between">
              <span className="uppercase tracking-wider font-bold">{lang}</span>
              <span className="text-[10px] text-zinc-500">code block</span>
            </div>
          )}
          <pre className="px-4 py-3.5 overflow-x-auto text-[13.5px] font-mono text-emerald-300 leading-relaxed">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // ── Horizontal rule (--- or ***) ─────────────────
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${i}`} className="border-[#383838] my-5 opacity-60" />);
      i++;
      continue;
    }

    // ── Headings ──────────────────────────────────────
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const sizeClass =
        level === 1 ? 'text-2xl font-bold mt-7 mb-3 border-b border-[#3f3f46]/40 pb-2' :
        level === 2 ? 'text-xl font-bold mt-6 mb-2.5' :
        level === 3 ? 'text-lg font-semibold mt-5 mb-2 text-zinc-100' :
        'text-base font-semibold mt-4 mb-1.5 text-zinc-200';
      blocks.push(
        <div key={`h-${i}`} className={`${sizeClass} text-white tracking-tight leading-snug`}>
          {formatInlineText(text, citations, onSelectCitation)}
        </div>
      );
      i++;
      continue;
    }

    // ── Blockquote ────────────────────────────────────
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('>')) {
        quoteLines.push(rawLines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <div
          key={`bq-${i}`}
          className="border-l-3 border-indigo-400 pl-4 py-2.5 my-3 bg-indigo-500/10 rounded-r-xl shadow-inner"
        >
          {quoteLines.map((ql, qi) => (
            <p key={qi} className="italic text-zinc-200 text-sm leading-relaxed">
              {formatInlineText(ql, citations, onSelectCitation)}
            </p>
          ))}
        </div>
      );
      continue;
    }

    // ── GFM Table (line starts with |) ───────────────
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('|')) {
        tableLines.push(rawLines[i]);
        i++;
      }
      const parsed = parseTable(tableLines);
      if (parsed) {
        const { headers, aligns, rows } = parsed;
        const alignClass = (a: string) =>
          a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : 'text-left';
        blocks.push(
          <div key={`tbl-${i}`} className="my-5 overflow-x-auto rounded-xl border border-[#3f3f46]/50 shadow-md">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#27272a] border-b border-[#3f3f46]/60 text-white">
                  {headers.map((h, hi) => (
                    <th
                      key={hi}
                      className={`px-4 py-3 font-semibold ${alignClass(aligns[hi] ?? 'left')}`}
                    >
                      {formatInlineText(h, citations, onSelectCitation)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a2e]">
                {rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className={`transition-colors ${
                      ri % 2 === 0 ? 'bg-[#18181b]/90' : 'bg-[#202023]/90'
                    } hover:bg-[#2a2a2e]`}
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={`px-4 py-2.5 text-zinc-200 ${alignClass(aligns[ci] ?? 'left')}`}
                      >
                        {formatInlineText(cell, citations, onSelectCitation)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // ── Bullet list ───────────────────────────────────
    if (/^[-*+]\s/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < rawLines.length && /^[-*+]\s/.test(rawLines[i].trim())) {
        listItems.push(rawLines[i].trim().replace(/^[-*+]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-3 space-y-2 ml-1">
          {listItems.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0 shadow-sm" />
              <span className="flex-1 text-zinc-200 text-[15px] leading-relaxed">
                {formatInlineText(item, citations, onSelectCitation)}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // ── Numbered list ─────────────────────────────────
    if (/^\d+\.\s/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < rawLines.length && /^\d+\.\s/.test(rawLines[i].trim())) {
        listItems.push(rawLines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="my-3 space-y-2 ml-1">
          {listItems.map((item, ii) => (
            <li key={ii} className="flex items-start gap-2.5">
              <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                {ii + 1}
              </span>
              <span className="flex-1 text-zinc-200 text-[15px] leading-relaxed">
                {formatInlineText(item, citations, onSelectCitation)}
              </span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // ── Paragraph ─────────────────────────────────────
    blocks.push(
      <p key={`p-${i}`} className="leading-relaxed text-zinc-200 text-[15px]">
        {formatInlineText(trimmed, citations, onSelectCitation)}
      </p>
    );
    i++;
  }

  return (
    <div className="space-y-2.5 font-sans text-[15px] text-zinc-100 leading-relaxed">
      {blocks}
    </div>
  );
};
