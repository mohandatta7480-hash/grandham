'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import { FontSize } from '@/lib/tiptap/fontSizeExtension';
import { Notebook, NotebookPage, PageTemplate, PdfAttachment, DrawingStroke, DrawingTool, StrokePoint } from '@/types';
import { supabase, getCurrentUserId } from '@/lib/supabase/client';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Star,
  Maximize2,
  Minimize2,
  FileSpreadsheet,
  ArrowLeft,
  Check,
  FolderInput,
  Trash2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { UnifiedPageToolbar, EditorMode } from './UnifiedPageToolbar';
import { UnifiedPageCanvas } from './UnifiedPageCanvas';
import { PageManagerDrawer } from './PageManagerDrawer';
import { MoveItemModal } from '@/components/modals/MoveItemModal';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';

interface NotebookViewerProps {
  notebook: Notebook;
  pages: NotebookPage[];
  onBack: () => void;
  onOpenPdfViewer?: (pdf: PdfAttachment) => void;
  onRefresh: () => void;
}

export const NotebookViewer: React.FC<NotebookViewerProps> = ({
  notebook: initialNotebook,
  pages: initialPages,
  onBack,
  onOpenPdfViewer,
  onRefresh,
}) => {
  const [notebook, setNotebook] = useState<Notebook>(initialNotebook);
  const [pages, setPages] = useState<NotebookPage[]>(initialPages);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState<boolean>(false);

  // Title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(notebook.title);

  // Save status: 'saved' | 'saving' | 'error'
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Mode & Drawing state
  const [mode, setMode] = useState<EditorMode>('text');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('pen');
  const [drawingColor, setDrawingColor] = useState<string>('#c7a15a');
  const [drawingSize, setDrawingSize] = useState<number>(4);
  const [palmRejection, setPalmRejection] = useState<boolean>(true);
  const [drawingHistory, setDrawingHistory] = useState<DrawingStroke[][]>([]);
  const [drawingRedoHistory, setDrawingRedoHistory] = useState<DrawingStroke[][]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validIndex = Math.min(Math.max(0, activePageIndex), Math.max(0, pages.length - 1));
  const currentPage = pages[validIndex];

  // Helper to extract content
  const extractPageDoc = (p?: NotebookPage) => {
    if (!p) return { type: 'doc', content: [{ type: 'paragraph' }] };
    if (p.typed_content || p.typedContent) {
      const tc = p.typed_content || p.typedContent;
      if (tc?.type === 'doc') return tc;
      if (typeof tc === 'object' && tc.json) return tc.json;
    }
    // Backward compatibility with blocks array
    if (p.blocks && Array.isArray(p.blocks) && p.blocks.length > 0) {
      const docContent: any[] = [];
      p.blocks.forEach((b) => {
        if (b.type === 'text' && b.content) {
          if (b.content.type === 'doc' && Array.isArray(b.content.content)) {
            docContent.push(...b.content.content);
          } else if (b.content.json?.content) {
            docContent.push(...b.content.json.content);
          }
        } else if (b.type === 'image' && b.content?.url) {
          docContent.push({
            type: 'image',
            attrs: {
              src: b.content.url,
              alt: b.content.caption || 'Note image',
            },
          });
        }
      });
      if (docContent.length > 0) {
        return { type: 'doc', content: docContent };
      }
    }
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  };

  // Debounced Page Update to Supabase
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdatePage = useCallback((updates: Partial<NotebookPage>) => {
    if (!currentPage) return;

    const updatedCurrent = { ...currentPage, ...updates };
    setPages((prev) => prev.map((p) => (p.id === currentPage.id ? updatedCurrent : p)));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus('saving');

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const payload: any = {
          updated_at: new Date().toISOString(),
        };
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.template !== undefined) payload.template = updates.template;
        if (updates.typed_content !== undefined) payload.typed_content = updates.typed_content;
        if (updates.drawing_strokes !== undefined) payload.drawing_strokes = updates.drawing_strokes;

        const { error } = await supabase
          .from('notebook_pages')
          .update(payload)
          .eq('id', currentPage.id);

        if (error) throw error;

        await supabase
          .from('notebooks')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', notebook.id);

        setSaveStatus('saved');
      } catch (err) {
        console.error('Failed to save page to Supabase:', err);
        setSaveStatus('error');
      }
    }, 450);
  }, [currentPage, notebook.id]);

  // TipTap Editor instance
  const editor = useEditor({
    immediatelyRender: false,
    autofocus: 'end',
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your notes directly on the page...',
      }),
      Underline,
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-app-accent underline decoration-app-accent/40 hover:decoration-app-accent cursor-pointer',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-2xl max-w-full my-4 border border-app-border shadow-subtle mx-auto cursor-pointer select-none',
        },
      }),
    ],
    content: extractPageDoc(currentPage),
    editable: true,
    onUpdate: ({ editor }) => {
      handleUpdatePage({
        typed_content: { json: editor.getJSON(), html: editor.getHTML() },
      });
    },
    editorProps: {
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
              const file = items[i].getAsFile();
              if (file) {
                event.preventDefault();
                handleInsertImageFile(file);
                return true;
              }
            }
          }
        }
        return false;
      },
    },
  });

  // Sync editor content when switching pages
  useEffect(() => {
    if (editor && currentPage) {
      const doc = extractPageDoc(currentPage);
      const cur = JSON.stringify(editor.getJSON());
      const incoming = JSON.stringify(doc);
      if (cur !== incoming) {
        editor.commands.setContent(doc, false);
      }
    }
  }, [currentPage?.id, editor]);

  // Load pages from Supabase
  const fetchSupabasePages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notebook_pages')
        .select('*')
        .eq('notebook_id', notebook.id)
        .eq('is_deleted', false)
        .order('page_number', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setPages(data);
      } else {
        const userId = await getCurrentUserId();
        const { data: newP1 } = await supabase
          .from('notebook_pages')
          .insert([
            {
              user_id: userId,
              notebook_id: notebook.id,
              page_number: 1,
              title: 'Page 1',
              template: notebook.default_template || notebook.defaultTemplate || 'ruled',
              typed_content: { type: 'doc', content: [{ type: 'paragraph' }] },
              drawing_strokes: [],
              is_deleted: false,
            },
          ])
          .select()
          .single();

        if (newP1) setPages([newP1]);
      }
    } catch (err) {
      console.error('Error fetching notebook pages:', err);
    }
  }, [notebook.id, notebook.default_template, notebook.defaultTemplate]);

  useEffect(() => {
    fetchSupabasePages();
  }, [fetchSupabasePages]);

  // Image Upload handler
  const handleInsertImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const localDataUrl = reader.result as string;

      let finalUrl = localDataUrl;
      try {
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('note-images')
          .upload(fileName, file, { cacheControl: '3600', upsert: true });

        if (!uploadErr && uploadData) {
          const { data: pubData } = supabase.storage
            .from('note-images')
            .getPublicUrl(fileName);
          if (pubData?.publicUrl) {
            finalUrl = pubData.publicUrl;
          }
        }
      } catch (e) {
        console.warn('Storage upload fallback to data URL:', e);
      }

      if (editor) {
        editor.chain().focus().setImage({ src: finalUrl, alt: file.name }).run();
      }
    };
    reader.readAsDataURL(file);
  };

  // Drawing Actions
  const handleAddDrawingStroke = (stroke: DrawingStroke) => {
    const currentStrokes = currentPage?.drawing_strokes || currentPage?.drawingStrokes || [];
    const nextStrokes = [...currentStrokes, stroke];
    setDrawingHistory((prev) => [...prev, currentStrokes]);
    setDrawingRedoHistory([]);
    handleUpdatePage({ drawing_strokes: nextStrokes });
  };

  const handleEraseAtPoint = (x: number, y: number) => {
    const currentStrokes = currentPage?.drawing_strokes || currentPage?.drawingStrokes || [];
    const radius = drawingSize * 8;
    const remaining = currentStrokes.filter((st: DrawingStroke) => {
      return !st.points?.some((p: StrokePoint) => Math.hypot(p.x - x, p.y - y) < radius);
    });

    if (remaining.length !== currentStrokes.length) {
      setDrawingHistory((prev) => [...prev, currentStrokes]);
      setDrawingRedoHistory([]);
      handleUpdatePage({ drawing_strokes: remaining });
    }
  };

  const handleUndoDrawing = () => {
    if (drawingHistory.length === 0) return;
    const currentStrokes = currentPage?.drawing_strokes || currentPage?.drawingStrokes || [];
    const last = drawingHistory[drawingHistory.length - 1];
    setDrawingRedoHistory((prev) => [...prev, currentStrokes]);
    setDrawingHistory((prev) => prev.slice(0, -1));
    handleUpdatePage({ drawing_strokes: last });
  };

  const handleRedoDrawing = () => {
    if (drawingRedoHistory.length === 0) return;
    const currentStrokes = currentPage?.drawing_strokes || currentPage?.drawingStrokes || [];
    const next = drawingRedoHistory[drawingRedoHistory.length - 1];
    setDrawingHistory((prev) => [...prev, currentStrokes]);
    setDrawingRedoHistory((prev) => prev.slice(0, -1));
    handleUpdatePage({ drawing_strokes: next });
  };

  const handleClearDrawing = () => {
    const currentStrokes = currentPage?.drawing_strokes || currentPage?.drawingStrokes || [];
    if (currentStrokes.length === 0) return;
    setDrawingHistory((prev) => [...prev, currentStrokes]);
    setDrawingRedoHistory([]);
    handleUpdatePage({ drawing_strokes: [] });
  };

  // Page Navigation actions
  const handleAddPage = async (template?: PageTemplate) => {
    try {
      setSaveStatus('saving');
      const userId = await getCurrentUserId();
      const nextNumber = pages.length + 1;

      const { data: newPage, error } = await supabase
        .from('notebook_pages')
        .insert([
          {
            user_id: userId,
            notebook_id: notebook.id,
            page_number: nextNumber,
            title: `Page ${nextNumber}`,
            template: template || notebook.default_template || notebook.defaultTemplate || 'ruled',
            typed_content: { type: 'doc', content: [{ type: 'paragraph' }] },
            drawing_strokes: [],
            is_deleted: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      if (newPage) {
        setPages((prev) => [...prev, newPage]);
        setActivePageIndex(pages.length);
        setSaveStatus('saved');
      }
    } catch (err) {
      console.error('Failed to add page:', err);
      setSaveStatus('error');
    }
  };

  const handleDuplicatePage = async (pageId: string) => {
    const pageToDup = pages.find((p) => p.id === pageId);
    if (!pageToDup) return;

    try {
      setSaveStatus('saving');
      const userId = await getCurrentUserId();
      const nextNumber = pages.length + 1;

      const { data: duped, error } = await supabase
        .from('notebook_pages')
        .insert([
          {
            user_id: userId,
            notebook_id: notebook.id,
            page_number: nextNumber,
            title: `${pageToDup.title} (Copy)`,
            template: pageToDup.template,
            typed_content: pageToDup.typed_content || pageToDup.typedContent,
            drawing_strokes: pageToDup.drawing_strokes || pageToDup.drawingStrokes || [],
            is_deleted: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      if (duped) {
        setPages((prev) => [...prev, duped]);
        setActivePageIndex(pages.length);
        setSaveStatus('saved');
      }
    } catch (err) {
      console.error('Failed to duplicate page:', err);
      setSaveStatus('error');
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (pages.length <= 1) return;

    try {
      setSaveStatus('saving');
      const { error } = await supabase
        .from('notebook_pages')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', pageId);

      if (error) throw error;

      const remaining = pages.filter((p) => p.id !== pageId);
      setPages(remaining);
      setActivePageIndex((prev) => Math.min(prev, remaining.length - 1));
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to delete page:', err);
      setSaveStatus('error');
    }
  };

  const handleMovePage = async (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= pages.length || toIndex < 0 || toIndex >= pages.length) return;

    const reordered = [...pages];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const updated = reordered.map((p, idx) => ({ ...p, page_number: idx + 1 }));
    setPages(updated);
    setActivePageIndex(toIndex);

    try {
      setSaveStatus('saving');
      await Promise.all(
        updated.map((p) =>
          supabase
            .from('notebook_pages')
            .update({ page_number: p.page_number, updated_at: new Date().toISOString() })
            .eq('id', p.id)
        )
      );
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to reorder pages:', err);
      setSaveStatus('error');
    }
  };

  const toggleSticky = async () => {
    const nextStarred = !notebook.is_starred;
    setNotebook((prev) => ({ ...prev, is_starred: nextStarred }));

    try {
      await supabase
        .from('notebooks')
        .update({ is_starred: nextStarred, updated_at: new Date().toISOString() })
        .eq('id', notebook.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle star:', err);
    }
  };

  const handleSaveNotebookTitle = async () => {
    setIsEditingTitle(false);
    if (!titleInput.trim() || titleInput === notebook.title) return;

    setNotebook((prev) => ({ ...prev, title: titleInput.trim() }));
    try {
      await supabase
        .from('notebooks')
        .update({ title: titleInput.trim(), updated_at: new Date().toISOString() })
        .eq('id', notebook.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to rename notebook:', err);
    }
  };

  const handleDeleteNotebook = async () => {
    if (!window.confirm(`Move "${notebook.title}" to Recycle Bin?`)) return;

    try {
      await supabase
        .from('notebooks')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', notebook.id);
      onRefresh();
      onBack();
    } catch (err) {
      console.error('Failed to delete notebook:', err);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-app-bg text-app-text select-none theme-transition">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 w-full bg-app-surface/95 backdrop-blur-md border-b border-app-border px-4 py-2 flex items-center justify-between shadow-subtle theme-transition">
        {/* Left: Back & Title Controls */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors"
            title="Back to Notebooks"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveNotebookTitle()}
                  autoFocus
                  className="bg-app-bg border border-app-accent rounded-lg px-2.5 py-1 text-xs text-app-text outline-none font-serif font-medium"
                />
                <button
                  type="button"
                  onClick={handleSaveNotebookTitle}
                  className="p-1 rounded-lg bg-app-accent text-white"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <h1
                onClick={() => setIsEditingTitle(true)}
                className="text-sm md:text-base font-serif font-medium text-app-text truncate max-w-[160px] md:max-w-md hover:text-app-accent cursor-pointer transition-colors"
                title="Click to rename notebook"
              >
                {notebook.title}
              </h1>
            )}

            <button
              type="button"
              onClick={toggleSticky}
              className={cn(
                'p-1 rounded-md transition-colors',
                notebook.is_starred ? 'text-app-accent' : 'text-app-text-dim hover:text-app-text'
              )}
              title={notebook.is_starred ? 'Unstar' : 'Star this notebook'}
            >
              <Star className={cn('w-3.5 h-3.5', notebook.is_starred && 'fill-current')} />
            </button>

            <button
              type="button"
              onClick={() => setIsMoveModalOpen(true)}
              className="p-1 rounded-md text-app-text-dim hover:text-app-text transition-colors"
              title="Move notebook to subject / folder"
            >
              <FolderInput className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleDeleteNotebook}
              className="p-1 rounded-md text-app-text-dim hover:text-rose-500 transition-colors"
              title="Delete notebook"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Multi-Page Stepper Navigation */}
        <div className="flex items-center gap-1 bg-app-bg px-2.5 py-1 rounded-xl border border-app-border shadow-subtle">
          <button
            type="button"
            onClick={() => setActivePageIndex((prev) => Math.max(0, prev - 1))}
            disabled={validIndex === 0}
            className="p-1 rounded text-app-text-muted hover:text-app-text disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="text-xs font-mono text-app-text font-medium px-2">
            {validIndex + 1} / {pages.length}
          </span>

          <button
            type="button"
            onClick={() => setActivePageIndex((prev) => Math.min(pages.length - 1, prev + 1))}
            disabled={validIndex === pages.length - 1}
            className="p-1 rounded text-app-text-muted hover:text-app-text disabled:opacity-30 disabled:pointer-events-none transition-all"
            title="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-app-border mx-0.5" />

          <button
            type="button"
            onClick={() => handleAddPage()}
            className="p-1 rounded text-app-accent hover:opacity-80 transition-opacity"
            title="Add Page"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Autosave Status, Pages Drawer, Fullscreen, Theme */}
        <div className="flex items-center gap-2">
          {/* Real Save Indicator */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-app-accent animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">Saving</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span className="hidden sm:inline">Saved</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-rose-500">
                <AlertCircle className="w-3 h-3" />
                <span className="hidden sm:inline">Error</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Open Pages Navigator Drawer"
          >
            <FileSpreadsheet className="w-4 h-4 text-app-accent" />
            <span className="hidden md:inline">Pages</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* EXACTLY ONE Fixed Contextual Editor Toolbar directly below Header */}
      <UnifiedPageToolbar
        mode={mode}
        onModeChange={(newMode) => {
          setMode(newMode);
          if (newMode === 'text' && editor) {
            setTimeout(() => editor.commands.focus('end'), 50);
          }
        }}
        editor={editor}
        drawingTool={drawingTool}
        setDrawingTool={setDrawingTool}
        drawingColor={drawingColor}
        setDrawingColor={setDrawingColor}
        drawingSize={drawingSize}
        setDrawingSize={setDrawingSize}
        canUndoDrawing={drawingHistory.length > 0}
        canRedoDrawing={drawingRedoHistory.length > 0}
        onUndoDrawing={handleUndoDrawing}
        onRedoDrawing={handleRedoDrawing}
        onClearDrawing={handleClearDrawing}
        palmRejection={palmRejection}
        setPalmRejection={setPalmRejection}
        onTriggerImageUpload={() => fileInputRef.current?.click()}
      />

      {/* Main Single Clean Ruled Writing Surface */}
      <main className="flex-1 px-4 md:px-8 py-6 max-w-5xl mx-auto w-full">
        {currentPage && (
          <UnifiedPageCanvas
            page={currentPage}
            mode={mode}
            editor={editor}
            drawingTool={drawingTool}
            drawingColor={drawingColor}
            drawingSize={drawingSize}
            palmRejection={palmRejection}
            strokes={currentPage.drawing_strokes || currentPage.drawingStrokes || []}
            onAddStroke={handleAddDrawingStroke}
            onEraseAtPoint={handleEraseAtPoint}
            onUpdateTitle={(newTitle) => handleUpdatePage({ title: newTitle })}
            onDropImage={handleInsertImageFile}
          />
        )}
      </main>

      {/* Slide-out Page Manager Drawer */}
      <PageManagerDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        pages={pages.map((p) => ({
          ...p,
          pageNumber: p.page_number || p.pageNumber || 1,
          typedContent: p.typed_content || p.typedContent,
          drawingStrokes: p.drawing_strokes || p.drawingStrokes || [],
          isDeleted: p.is_deleted || p.isDeleted || false,
          createdAt: p.created_at || p.createdAt || '',
          updatedAt: p.updated_at || p.updatedAt || '',
          images: p.images || [],
          urls: p.urls || [],
          pdfAttachments: p.pdfAttachments || [],
        }))}
        activePageIndex={validIndex}
        onSelectPage={(index) => {
          setActivePageIndex(index);
          setIsDrawerOpen(false);
        }}
        onAddPage={handleAddPage}
        onDuplicatePage={handleDuplicatePage}
        onDeletePage={handleDeletePage}
        onMovePage={handleMovePage}
      />

      {/* Move Notebook Modal */}
      <MoveItemModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        itemType="notebook"
        itemId={notebook.id}
        itemTitle={notebook.title}
        currentSubjectId={notebook.subject_id}
        currentFolderId={notebook.folder_id}
        onMoved={() => {
          onRefresh();
          fetchSupabasePages();
        }}
      />

      {/* Hidden File Input for Image Uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleInsertImageFile(file);
          }
          e.target.value = '';
        }}
        className="hidden"
      />
    </div>
  );
};
