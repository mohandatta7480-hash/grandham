'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NotebookPage, PageBlock, PageTemplate } from '@/types';
import { PageBackground } from './PageBackground';
import { TextBlock, TextBlockHandle } from './blocks/TextBlock';
import { DrawingBlock } from './blocks/DrawingBlock';
import { ImageBlock } from './blocks/ImageBlock';
import {
  Type,
  PenTool,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Trash2,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageCanvasProps {
  page: NotebookPage;
  onUpdatePage: (updates: Partial<NotebookPage>) => void;
}

export const PageCanvas: React.FC<PageCanvasProps> = ({ page, onUpdatePage }) => {
  const [blocks, setBlocks] = useState<PageBlock[]>(() => {
    if (page.blocks && Array.isArray(page.blocks) && page.blocks.length > 0) {
      return page.blocks;
    }
    const initialList: PageBlock[] = [];
    if (page.typed_content || page.typedContent) {
      initialList.push({
        id: crypto.randomUUID(),
        type: 'text',
        content: page.typed_content || page.typedContent,
      });
    }
    if (page.drawing_strokes && page.drawing_strokes.length > 0) {
      initialList.push({
        id: crypto.randomUUID(),
        type: 'drawing',
        content: { strokes: page.drawing_strokes },
      });
    }
    if (initialList.length === 0) {
      initialList.push({
        id: crypto.randomUUID(),
        type: 'text',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
      });
    }
    return initialList;
  });

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(page.title || `Page ${page.page_number || page.pageNumber || 1}`);
  const [isPageDragOver, setIsPageDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetInsertIndexRef = useRef<number | null>(null);
  const textBlockRefs = useRef<Map<string, TextBlockHandle>>(new Map());

  // Sync state when page changes
  useEffect(() => {
    setTitleInput(page.title || `Page ${page.page_number || page.pageNumber || 1}`);

    if (page.blocks && Array.isArray(page.blocks) && page.blocks.length > 0) {
      setBlocks(page.blocks);
    }
  }, [page.id]);

  // Update a block
  const handleBlockChange = (blockId: string, newContent: any) => {
    const nextBlocks = blocks.map((b) => (b.id === blockId ? { ...b, content: newContent } : b));
    setBlocks(nextBlocks);
    onUpdatePage({ blocks: nextBlocks });
  };

  // Add block at index
  const handleAddBlock = (type: 'text' | 'drawing' | 'image', afterIndex?: number) => {
    const newBlockId = crypto.randomUUID();
    const newBlock: PageBlock = {
      id: newBlockId,
      type,
      content:
        type === 'text'
          ? { type: 'doc', content: [{ type: 'paragraph' }] }
          : type === 'drawing'
          ? { strokes: [], height: 280 }
          : { url: '', caption: '', size: 'large' },
    };

    let nextBlocks: PageBlock[];
    if (afterIndex !== undefined && afterIndex >= 0 && afterIndex < blocks.length) {
      nextBlocks = [
        ...blocks.slice(0, afterIndex + 1),
        newBlock,
        ...blocks.slice(afterIndex + 1),
      ];
    } else {
      nextBlocks = [...blocks, newBlock];
    }

    setBlocks(nextBlocks);
    onUpdatePage({ blocks: nextBlocks });

    // If text block, focus it immediately
    if (type === 'text') {
      setTimeout(() => {
        const handle = textBlockRefs.current.get(newBlockId);
        if (handle) {
          handle.focus();
        }
      }, 50);
    }
  };

  // Move block
  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const nextBlocks = [...blocks];
    const [moved] = nextBlocks.splice(index, 1);
    nextBlocks.splice(targetIndex, 0, moved);

    setBlocks(nextBlocks);
    onUpdatePage({ blocks: nextBlocks });
  };

  // Delete block
  const handleDeleteBlock = (blockId: string) => {
    if (blocks.length <= 1) {
      const fallback: PageBlock[] = [
        {
          id: crypto.randomUUID(),
          type: 'text',
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
        },
      ];
      setBlocks(fallback);
      onUpdatePage({ blocks: fallback });
      return;
    }

    const nextBlocks = blocks.filter((b) => b.id !== blockId);
    setBlocks(nextBlocks);
    onUpdatePage({ blocks: nextBlocks });
  };

  // Paste Image File Handler
  const handlePasteImageFile = useCallback((file: File, afterIndex?: number) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      const newBlock: PageBlock = {
        id: crypto.randomUUID(),
        type: 'image',
        content: {
          url: base64Url,
          caption: file.name || 'Pasted image',
          size: 'large',
        },
      };

      let nextBlocks: PageBlock[];
      const idx = afterIndex !== undefined && afterIndex >= 0 ? afterIndex : blocks.length - 1;
      nextBlocks = [
        ...blocks.slice(0, idx + 1),
        newBlock,
        ...blocks.slice(idx + 1),
      ];

      setBlocks(nextBlocks);
      onUpdatePage({ blocks: nextBlocks });
    };
    reader.readAsDataURL(file);
  }, [blocks, onUpdatePage]);

  // Window paste listener
  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handlePasteImageFile(file, blocks.length - 1);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [blocks.length, handlePasteImageFile]);

  // Drag & drop file onto the physical page
  const handlePageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsPageDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          handlePasteImageFile(files[i], blocks.length - 1);
        }
      }
    }
  };

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (titleInput.trim()) {
      onUpdatePage({ title: titleInput.trim() });
    }
  };

  const triggerImageUploadForIndex = (index?: number) => {
    targetInsertIndexRef.current = index !== undefined ? index : blocks.length - 1;
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 pb-24">
      {/* Page Header Bar */}
      <div className="flex items-center justify-between px-2 text-app-text-muted">
        {/* Page Title & Number */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-lg bg-app-surface border border-app-border text-app-accent font-medium shadow-subtle">
            PAGE {page.page_number || page.pageNumber || 1}
          </span>

          {isEditingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                autoFocus
                className="bg-app-surface border border-app-accent text-app-text text-sm px-2.5 py-1 rounded-xl outline-none font-serif font-medium"
              />
              <button
                type="button"
                onClick={handleTitleSubmit}
                className="p-1 rounded-lg bg-app-accent text-white"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <h3
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-medium font-serif text-app-text hover:text-app-accent cursor-pointer transition-colors"
              title="Click to rename page"
            >
              {page.title || `Page ${page.page_number || page.pageNumber || 1}`}
            </h3>
          )}
        </div>

        {/* Top Quick Block Insert Actions */}
        <div className="flex items-center gap-1 bg-app-surface p-1 rounded-2xl border border-app-border text-xs shadow-subtle">
          <button
            type="button"
            onClick={() => handleAddBlock('text', blocks.length - 1)}
            className="p-1.5 rounded-xl text-app-text-muted hover:text-app-text hover:bg-app-surface-hover flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
            title="Add text section"
          >
            <Type className="w-3.5 h-3.5 text-app-accent" />
            <span className="text-[11px] font-medium">+ Text</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddBlock('drawing', blocks.length - 1)}
            className="p-1.5 rounded-xl text-app-text-muted hover:text-app-text hover:bg-app-surface-hover flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
            title="Insert S Pen / Drawing Canvas"
          >
            <PenTool className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-medium">+ Drawing</span>
          </button>

          <button
            type="button"
            onClick={() => triggerImageUploadForIndex(blocks.length - 1)}
            className="p-1.5 rounded-xl text-app-text-muted hover:text-app-text hover:bg-app-surface-hover flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
            title="Insert Image"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-medium">+ Image</span>
          </button>
        </div>
      </div>

      {/* Main Physical Page Writing Surface */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsPageDragOver(true);
        }}
        onDragLeave={() => setIsPageDragOver(false)}
        onDrop={handlePageDrop}
        className={cn(
          'relative rounded-3xl border transition-all min-h-[850px] md:min-h-[1050px] p-6 sm:p-12 shadow-elevated bg-app-surface/95 backdrop-blur-sm flex flex-col',
          isPageDragOver
            ? 'border-app-accent ring-4 ring-app-accent/20 bg-app-accent/5'
            : 'border-app-border'
        )}
      >
        {/* Paper texture (pure absolute backdrop) */}
        <PageBackground template={page.template || 'ruled'} />

        {/* Ordered Page Blocks */}
        <div className="relative z-10 space-y-6 flex-1">
          {blocks.map((block, index) => (
            <div key={block.id} className="relative group/block transition-all">
              {/* Block reordering / delete controls on hover */}
              <div className="opacity-0 group-hover/block:opacity-100 transition-opacity absolute -top-3.5 right-2 z-30 flex items-center gap-0.5 p-0.5 bg-app-surface/95 backdrop-blur-md border border-app-border rounded-xl shadow-elevated">
                <button
                  type="button"
                  onClick={() => handleMoveBlock(index, 'up')}
                  disabled={index === 0}
                  className="p-1 rounded text-app-text-muted hover:text-app-text disabled:opacity-20 transition-colors"
                  title="Move section up"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={() => handleMoveBlock(index, 'down')}
                  disabled={index === blocks.length - 1}
                  className="p-1 rounded text-app-text-muted hover:text-app-text disabled:opacity-20 transition-colors"
                  title="Move section down"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteBlock(block.id)}
                  className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition-colors"
                  title="Delete section"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Render Block Content */}
              {block.type === 'text' && (
                <TextBlock
                  ref={(el) => {
                    if (el) textBlockRefs.current.set(block.id, el);
                    else textBlockRefs.current.delete(block.id);
                  }}
                  content={block.content}
                  onChange={(c) => handleBlockChange(block.id, c)}
                  onPasteImage={(file) => handlePasteImageFile(file, index)}
                  onInsertDrawing={() => handleAddBlock('drawing', index)}
                  onInsertImage={() => triggerImageUploadForIndex(index)}
                  placeholder={index === 0 ? 'Start typing your notes here...' : 'Write notes...'}
                />
              )}

              {block.type === 'drawing' && (
                <DrawingBlock
                  content={block.content}
                  onChange={(c) => handleBlockChange(block.id, c)}
                  onDelete={() => handleDeleteBlock(block.id)}
                />
              )}

              {block.type === 'image' && (
                <ImageBlock
                  content={block.content}
                  onChange={(c) => handleBlockChange(block.id, c)}
                  onDelete={() => handleDeleteBlock(block.id)}
                />
              )}

              {/* Subtle Between-Block Insertion Bar */}
              <div className="opacity-0 group-hover/block:opacity-80 hover:!opacity-100 transition-opacity flex items-center justify-center gap-2 py-2 text-app-text-dim">
                <div className="h-px bg-app-border flex-1" />
                <button
                  type="button"
                  onClick={() => handleAddBlock('text', index)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium hover:text-app-text hover:bg-app-surface border border-transparent hover:border-app-border transition-all flex items-center gap-1 shadow-subtle cursor-pointer"
                >
                  <Type className="w-3 h-3 text-app-accent" />
                  <span>+ Text</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddBlock('drawing', index)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium hover:text-app-text hover:bg-app-surface border border-transparent hover:border-app-border transition-all flex items-center gap-1 shadow-subtle cursor-pointer"
                >
                  <PenTool className="w-3 h-3 text-cyan-400" />
                  <span>+ Drawing</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerImageUploadForIndex(index)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium hover:text-app-text hover:bg-app-surface border border-transparent hover:border-app-border transition-all flex items-center gap-1 shadow-subtle cursor-pointer"
                >
                  <ImageIcon className="w-3 h-3 text-emerald-400" />
                  <span>+ Image</span>
                </button>
                <div className="h-px bg-app-border flex-1" />
              </div>
            </div>
          ))}

          {/* Bottom Click Area: Clicking in bottom empty area focuses or appends text */}
          <div
            onClick={() => {
              const lastBlock = blocks[blocks.length - 1];
              if (lastBlock && lastBlock.type === 'text') {
                const handle = textBlockRefs.current.get(lastBlock.id);
                if (handle) handle.focus();
              } else {
                handleAddBlock('text');
              }
            }}
            className="min-h-[200px] cursor-text flex items-center justify-center text-xs text-app-text-dim/40 italic font-serif"
          >
            Click here to continue typing notes...
          </div>
        </div>
      </div>

      {/* Hidden File Input for Image Uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handlePasteImageFile(file, targetInsertIndexRef.current ?? blocks.length - 1);
          }
          e.target.value = '';
        }}
        className="hidden"
      />
    </div>
  );
};
