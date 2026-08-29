'use client';

import React from 'react';
import { NotebookPage, PageTemplate } from '@/types';
import {
  Plus,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageManagerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pages: NotebookPage[];
  activePageIndex: number;
  onSelectPage: (index: number) => void;
  onAddPage: (template?: PageTemplate) => void;
  onDuplicatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  onMovePage: (fromIndex: number, toIndex: number) => void;
}

export const PageManagerDrawer: React.FC<PageManagerDrawerProps> = ({
  isOpen,
  onClose,
  pages,
  activePageIndex,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-72 md:w-80 bg-dark-900/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl flex flex-col transition-all">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-brand-400" />
          <h3 className="font-semibold text-sm text-white">Pages Manager</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {pages.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Pages List / Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {pages.map((page, index) => {
          const isActive = index === activePageIndex;
          return (
            <div
              key={page.id}
              onClick={() => onSelectPage(index)}
              className={cn(
                'group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2',
                isActive
                  ? 'bg-brand-500/10 border-brand-500 shadow-glow'
                  : 'bg-dark-950/60 border-slate-800 hover:border-slate-700 hover:bg-dark-950'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      'text-xs font-mono px-2 py-0.5 rounded font-bold',
                      isActive ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-400'
                    )}
                  >
                    #{index + 1}
                  </span>
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {page.title || `Page ${index + 1}`}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-mono text-slate-500">
                  {page.template}
                </span>
              </div>

              {/* Page Thumbnail Miniature */}
              <div className="w-full h-16 rounded-lg bg-dark-900 border border-slate-800/80 p-2 overflow-hidden flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="h-1.5 w-3/4 bg-slate-700/60 rounded" />
                  <div className="h-1.5 w-1/2 bg-slate-700/40 rounded" />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>{page.drawingStrokes?.length || 0} strokes</span>
                  <span>{page.images?.length || 0} media</span>
                </div>
              </div>

              {/* Actions Toolbar */}
              <div className="flex items-center justify-end gap-1 pt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMovePage(index, index - 1);
                    }}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                    title="Move Up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                )}
                {index < pages.length - 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMovePage(index, index + 1);
                    }}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                    title="Move Down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicatePage(page.id);
                  }}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400"
                  title="Duplicate Page"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {pages.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Move Page ${index + 1} to Recycle Bin?`)) {
                        onDeletePage(page.id);
                      }
                    }}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                    title="Delete Page"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Page Footer Button */}
      <div className="p-4 border-t border-slate-800 bg-dark-950/80">
        <button
          type="button"
          onClick={() => onAddPage()}
          className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-glow transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Page</span>
        </button>
      </div>
    </div>
  );
};
