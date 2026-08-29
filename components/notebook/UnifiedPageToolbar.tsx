'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { DrawingTool } from '@/types';
import {
  Type,
  PenTool,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Link as LinkIcon,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Palette,
  Highlighter,
  Eraser,
  Trash2,
  ChevronDown,
  Check,
  RemoveFormatting,
  Hand,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type EditorMode = 'text' | 'draw' | 'image';

interface UnifiedPageToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  editor: Editor | null;
  // Drawing state & actions
  drawingTool: DrawingTool;
  setDrawingTool: (tool: DrawingTool) => void;
  drawingColor: string;
  setDrawingColor: (color: string) => void;
  drawingSize: number;
  setDrawingSize: (size: number) => void;
  canUndoDrawing: boolean;
  canRedoDrawing: boolean;
  onUndoDrawing: () => void;
  onRedoDrawing: () => void;
  onClearDrawing: () => void;
  palmRejection: boolean;
  setPalmRejection: (val: boolean) => void;
  // Image action
  onTriggerImageUpload: () => void;
}

const FONT_SIZES = [
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '32', value: '32px' },
  { label: '40', value: '40px' },
];

const TEXT_COLORS = [
  { label: 'Default', value: 'inherit' },
  { label: 'Gold', value: '#c7a15a' },
  { label: 'Cyan', value: '#38bdf8' },
  { label: 'Green', value: '#4ade80' },
  { label: 'Yellow', value: '#facc15' },
  { label: 'Coral', value: '#f43f5e' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Slate', value: '#94a3b8' },
  { label: 'Dark', value: '#1e293b' },
];

const DRAWING_COLORS = [
  { label: 'Gold', value: '#c7a15a' },
  { label: 'Cyan', value: '#38bdf8' },
  { label: 'Green', value: '#4ade80' },
  { label: 'Yellow', value: '#facc15' },
  { label: 'Coral', value: '#f43f5e' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'White', value: '#ffffff' },
  { label: 'Slate', value: '#94a3b8' },
  { label: 'Dark', value: '#1e293b' },
];

const STROKE_SIZES = [
  { label: 'Fine', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Thick', value: 8 },
  { label: 'Bold', value: 16 },
];

export const UnifiedPageToolbar: React.FC<UnifiedPageToolbarProps> = ({
  mode,
  onModeChange,
  editor,
  drawingTool,
  setDrawingTool,
  drawingColor,
  setDrawingColor,
  drawingSize,
  setDrawingSize,
  canUndoDrawing,
  canRedoDrawing,
  onUndoDrawing,
  onRedoDrawing,
  onClearDrawing,
  palmRejection,
  setPalmRejection,
  onTriggerImageUpload,
}) => {
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [showTextColorMenu, setShowTextColorMenu] = useState(false);

  const headingRef = useRef<HTMLDivElement>(null);
  const fontRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (headingRef.current && !headingRef.current.contains(e.target as Node)) {
        setShowHeadingMenu(false);
      }
      if (fontRef.current && !fontRef.current.contains(e.target as Node)) {
        setShowFontSizeMenu(false);
      }
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowTextColorMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSetLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Enter web link URL (e.g. https://example.com):', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const getHeadingLabel = () => {
    if (!editor) return 'Normal text';
    if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
    return 'Normal text';
  };

  const getFontSizeLabel = () => {
    if (!editor) return '16';
    const attrs = editor.getAttributes('textStyle');
    if (attrs?.fontSize) {
      return attrs.fontSize.replace('px', '');
    }
    return '16';
  };

  return (
    <div className="w-full bg-app-surface/95 backdrop-blur-md border-b border-app-border px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-subtle z-30 transition-all">
      {/* Left: Mode Switcher Tabs */}
      <div className="flex items-center gap-1 bg-app-bg p-1 rounded-xl border border-app-border shadow-subtle">
        <button
          type="button"
          onClick={() => onModeChange('text')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
            mode === 'text'
              ? 'bg-app-accent text-white shadow-subtle'
              : 'text-app-text-muted hover:text-app-text'
          )}
          title="Text mode: type notes directly onto the ruled page"
        >
          <Type className="w-3.5 h-3.5" />
          <span>Text</span>
        </button>

        <button
          type="button"
          onClick={() => onModeChange('draw')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer',
            mode === 'draw'
              ? 'bg-app-accent text-white shadow-subtle'
              : 'text-app-text-muted hover:text-app-text'
          )}
          title="Draw mode: full-page S Pen and touch drawing"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>Draw</span>
        </button>

        <button
          type="button"
          onClick={onTriggerImageUpload}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all text-app-text-muted hover:text-app-text cursor-pointer"
          title="Insert image at current location"
        >
          <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
          <span>Image</span>
        </button>
      </div>

      {/* Middle & Right: Contextual Controls based on Mode */}

      {/* 1. TEXT MODE CONTROLS */}
      {mode === 'text' && editor && (
        <div className="flex flex-wrap items-center gap-1 animate-fade-in">
          {/* Undo / Redo */}
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover disabled:opacity-30 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover disabled:opacity-30 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-app-border mx-0.5" />

          {/* Heading Style Dropdown */}
          <div className="relative" ref={headingRef}>
            <button
              type="button"
              onClick={() => setShowHeadingMenu(!showHeadingMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-app-text hover:bg-app-surface-hover transition-colors"
              title="Heading Style"
            >
              <span>{getHeadingLabel()}</span>
              <ChevronDown className="w-3 h-3 text-app-text-muted" />
            </button>

            {showHeadingMenu && (
              <div className="absolute top-full left-0 mt-1 w-36 bg-app-surface border border-app-border rounded-xl shadow-elevated py-1 z-50 animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().setParagraph().run();
                    setShowHeadingMenu(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs hover:bg-app-surface-hover transition-colors flex items-center justify-between',
                    !editor.isActive('heading') ? 'text-app-accent font-medium' : 'text-app-text'
                  )}
                >
                  <span>Normal text</span>
                  {!editor.isActive('heading') && <Check className="w-3 h-3" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 1 }).run();
                    setShowHeadingMenu(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm font-bold hover:bg-app-surface-hover transition-colors flex items-center justify-between',
                    editor.isActive('heading', { level: 1 }) ? 'text-app-accent' : 'text-app-text'
                  )}
                >
                  <span>Heading 1</span>
                  {editor.isActive('heading', { level: 1 }) && <Check className="w-3 h-3" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 2 }).run();
                    setShowHeadingMenu(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-app-surface-hover transition-colors flex items-center justify-between',
                    editor.isActive('heading', { level: 2 }) ? 'text-app-accent' : 'text-app-text'
                  )}
                >
                  <span>Heading 2</span>
                  {editor.isActive('heading', { level: 2 }) && <Check className="w-3 h-3" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 3 }).run();
                    setShowHeadingMenu(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-app-surface-hover transition-colors flex items-center justify-between',
                    editor.isActive('heading', { level: 3 }) ? 'text-app-accent' : 'text-app-text'
                  )}
                >
                  <span>Heading 3</span>
                  {editor.isActive('heading', { level: 3 }) && <Check className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>

          {/* Font Size Dropdown */}
          <div className="relative" ref={fontRef}>
            <button
              type="button"
              onClick={() => setShowFontSizeMenu(!showFontSizeMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono text-app-text hover:bg-app-surface-hover transition-colors"
              title="Font Size"
            >
              <span>{getFontSizeLabel()}px</span>
              <ChevronDown className="w-3 h-3 text-app-text-muted" />
            </button>

            {showFontSizeMenu && (
              <div className="absolute top-full left-0 mt-1 w-24 bg-app-surface border border-app-border rounded-xl shadow-elevated py-1 z-50 max-h-48 overflow-y-auto">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    onClick={() => {
                      (editor.chain().focus() as any).setFontSize(size.value);
                      setShowFontSizeMenu(false);
                    }}
                    className="w-full text-left px-3 py-1 text-xs font-mono text-app-text hover:bg-app-surface-hover hover:text-app-accent transition-colors"
                  >
                    {size.label}px
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-app-border mx-0.5" />

          {/* Bold, Italic, Underline, Strike */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              editor.isActive('bold')
                ? 'bg-app-accent text-white font-bold'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              editor.isActive('italic')
                ? 'bg-app-accent text-white font-bold'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              editor.isActive('underline')
                ? 'bg-app-accent text-white font-bold'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              editor.isActive('strike')
                ? 'bg-app-accent text-white font-bold'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Strikethrough"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>

          {/* Text Color Picker */}
          <div className="relative" ref={colorRef}>
            <button
              type="button"
              onClick={() => setShowTextColorMenu(!showTextColorMenu)}
              className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors flex items-center gap-0.5"
              title="Text Color"
            >
              <Palette className="w-3.5 h-3.5" />
              <div
                className="w-2 h-2 rounded-full border border-black/20"
                style={{ backgroundColor: editor.getAttributes('textStyle').color || 'currentColor' }}
              />
            </button>

            {showTextColorMenu && (
              <div className="absolute top-full left-0 mt-1 p-2 bg-app-surface border border-app-border rounded-xl shadow-elevated z-50 space-y-2 w-44 animate-fade-in">
                <p className="text-[10px] font-medium text-app-text-muted">Preset Colors</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {TEXT_COLORS.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      onClick={() => {
                        if (swatch.value === 'inherit') {
                          editor.chain().focus().unsetColor().run();
                        } else {
                          editor.chain().focus().setColor(swatch.value).run();
                        }
                        setShowTextColorMenu(false);
                      }}
                      style={{ backgroundColor: swatch.value === 'inherit' ? 'transparent' : swatch.value }}
                      className={cn(
                        'w-6 h-6 rounded-lg border border-app-border hover:scale-110 transition-transform flex items-center justify-center',
                        swatch.value === 'inherit' && 'text-[9px] text-app-text font-mono'
                      )}
                      title={swatch.label}
                    >
                      {swatch.value === 'inherit' && 'Auto'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 pt-1 border-t border-app-border">
                  <input
                    type="color"
                    onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                    className="w-6 h-6 rounded border border-app-border cursor-pointer bg-transparent"
                    title="Custom color picker"
                  />
                  <span className="text-[10px] text-app-text-dim">Custom color</span>
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-app-border mx-0.5" />

          {/* Text Alignments */}
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              editor.isActive({ textAlign: 'left' })
                ? 'bg-app-accent text-white'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Align Left"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              editor.isActive({ textAlign: 'center' })
                ? 'bg-app-accent text-white'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Align Center"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              editor.isActive({ textAlign: 'right' })
                ? 'bg-app-accent text-white'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Align Right"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              editor.isActive({ textAlign: 'justify' })
                ? 'bg-app-accent text-white'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Justify"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-app-border mx-0.5" />

          {/* Lists & Checklists */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              editor.isActive('bulletList')
                ? 'bg-app-accent text-white'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Bulleted List"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              editor.isActive('orderedList')
                ? 'bg-app-accent text-white'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Numbered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              editor.isActive('taskList')
                ? 'bg-app-accent text-white'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Task Checklist"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleSetLink}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              editor.isActive('link')
                ? 'bg-app-accent text-white'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Insert Link"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            className="p-1.5 rounded-lg text-xs text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors"
            title="Clear Formatting"
          >
            <RemoveFormatting className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. DRAW MODE CONTROLS */}
      {mode === 'draw' && (
        <div className="flex flex-wrap items-center gap-1.5 animate-fade-in">
          {/* Tools: Pen, Highlighter, Eraser */}
          <button
            type="button"
            onClick={() => setDrawingTool('pen')}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1',
              drawingTool === 'pen'
                ? 'bg-app-accent text-white font-medium shadow-subtle'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Pen"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Pen</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawingTool('highlighter')}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1',
              drawingTool === 'highlighter'
                ? 'bg-app-accent text-white font-medium shadow-subtle'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Highlighter"
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Highlighter</span>
          </button>

          <button
            type="button"
            onClick={() => setDrawingTool('eraser')}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1',
              drawingTool === 'eraser'
                ? 'bg-app-accent text-white font-medium shadow-subtle'
                : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
            )}
            title="Eraser"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Eraser</span>
          </button>

          <div className="w-px h-4 bg-app-border mx-1" />

          {/* Color Presets */}
          {drawingTool !== 'eraser' && (
            <div className="flex items-center gap-1">
              {DRAWING_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setDrawingColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={cn(
                    'w-4 h-4 rounded-full border transition-transform',
                    drawingColor === c.value
                      ? 'scale-125 border-white shadow-sm ring-2 ring-app-accent'
                      : 'border-black/20 opacity-80 hover:opacity-100'
                  )}
                  title={c.label}
                />
              ))}

              <input
                type="color"
                value={drawingColor}
                onChange={(e) => setDrawingColor(e.target.value)}
                className="w-4 h-4 rounded-full border border-app-border cursor-pointer bg-transparent ml-0.5"
                title="Custom color"
              />
            </div>
          )}

          <div className="w-px h-4 bg-app-border mx-1" />

          {/* Stroke Thickness */}
          <div className="flex items-center gap-1 text-[11px] text-app-text-muted">
            {STROKE_SIZES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setDrawingSize(s.value)}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors',
                  drawingSize === s.value
                    ? 'bg-app-accent text-white font-bold'
                    : 'hover:bg-app-surface-hover text-app-text-muted'
                )}
                title={`${s.label} thickness (${s.value}px)`}
              >
                {s.value}px
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-app-border mx-1" />

          {/* Undo / Redo / Clear */}
          <button
            type="button"
            onClick={onUndoDrawing}
            disabled={!canUndoDrawing}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover disabled:opacity-30 transition-colors"
            title="Undo stroke"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onRedoDrawing}
            disabled={!canRedoDrawing}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover disabled:opacity-30 transition-colors"
            title="Redo stroke"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClearDrawing}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
            title="Clear all drawings"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Palm rejection */}
          <button
            type="button"
            onClick={() => setPalmRejection(!palmRejection)}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 ml-1',
              palmRejection
                ? 'bg-app-accent/15 text-app-accent font-medium'
                : 'text-app-text-dim hover:text-app-text'
            )}
            title="Palm rejection (Pen-only drawing vs finger touch)"
          >
            <Hand className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">{palmRejection ? 'Palm Rejection On' : 'Touch Draw'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
