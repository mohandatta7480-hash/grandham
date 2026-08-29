'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { FontSize } from '@/lib/tiptap/fontSizeExtension';
import {
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
  PenTool,
  Image as ImageIcon,
  ChevronDown,
  Check,
  RemoveFormatting,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TextBlockHandle {
  focus: () => void;
}

interface TextBlockProps {
  content: any;
  onChange: (newContent: any) => void;
  onPasteImage?: (file: File) => void;
  onInsertDrawing?: () => void;
  onInsertImage?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
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

const COLOR_SWATCHES = [
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

export const TextBlock = forwardRef<TextBlockHandle, TextBlockProps>(({
  content,
  onChange,
  onPasteImage,
  onInsertDrawing,
  onInsertImage,
  placeholder = 'Type your notes here...',
  autoFocus = false,
}, ref) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHeadingMenu, setShowHeadingMenu] = useState(false);
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const headingMenuRef = useRef<HTMLDivElement>(null);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? 'end' : false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
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
    ],
    content: content?.json || content || { type: 'doc', content: [{ type: 'paragraph' }] },
    editable: true,
    onUpdate: ({ editor }) => {
      onChange({ json: editor.getJSON(), html: editor.getHTML() });
    },
    editorProps: {
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
              const file = items[i].getAsFile();
              if (file && onPasteImage) {
                event.preventDefault();
                onPasteImage(file);
                return true;
              }
            }
          }
        }
        return false;
      },
    },
  });

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (editor) {
        editor.commands.focus('end');
      }
    },
  }), [editor]);

  // Sync content when page changes externally
  useEffect(() => {
    if (editor && content) {
      const incoming = content?.json || content;
      const current = editor.getJSON();
      if (JSON.stringify(incoming) !== JSON.stringify(current)) {
        editor.commands.setContent(incoming, false);
      }
    }
  }, [content, editor]);

  // Close menus on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
      if (headingMenuRef.current && !headingMenuRef.current.contains(e.target as Node)) {
        setShowHeadingMenu(false);
      }
      if (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(e.target as Node)) {
        setShowFontSizeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!editor) {
    return <div className="p-4 text-xs text-app-text-dim animate-pulse">Loading note editor...</div>;
  }

  const handleSetLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter web link URL (e.g. https://example.com):', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const getActiveHeadingLabel = () => {
    if (editor.isActive('heading', { level: 1 })) return 'Heading 1';
    if (editor.isActive('heading', { level: 2 })) return 'Heading 2';
    if (editor.isActive('heading', { level: 3 })) return 'Heading 3';
    return 'Normal text';
  };

  const getCurrentFontSize = () => {
    const attrs = editor.getAttributes('textStyle');
    if (attrs?.fontSize) {
      return attrs.fontSize.replace('px', '');
    }
    return '16';
  };

  return (
    <div ref={containerRef} className="relative group/text w-full my-2">
      {/* Clean Google-Docs-like formatting toolbar */}
      <div
        className="flex flex-wrap items-center gap-0.5 p-1 mb-2 bg-app-surface/95 backdrop-blur-md border border-app-border rounded-2xl shadow-elevated z-30 sticky top-14 transition-all opacity-90 group-hover/text:opacity-100 focus-within:opacity-100"
      >
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
        <div className="relative" ref={headingMenuRef}>
          <button
            type="button"
            onClick={() => setShowHeadingMenu(!showHeadingMenu)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-app-text hover:bg-app-surface-hover transition-colors"
            title="Text Style"
          >
            <span>{getActiveHeadingLabel()}</span>
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
        <div className="relative" ref={fontSizeMenuRef}>
          <button
            type="button"
            onClick={() => setShowFontSizeMenu(!showFontSizeMenu)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono text-app-text hover:bg-app-surface-hover transition-colors"
            title="Font Size"
          >
            <span>{getCurrentFontSize()}px</span>
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
        <div className="relative" ref={colorPickerRef}>
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors flex items-center gap-0.5"
            title="Text Color"
          >
            <Palette className="w-3.5 h-3.5" />
            <div
              className="w-2 h-2 rounded-full border border-black/20"
              style={{ backgroundColor: editor.getAttributes('textStyle').color || 'currentColor' }}
            />
          </button>

          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-app-surface border border-app-border rounded-xl shadow-elevated z-50 space-y-2 w-44 animate-fade-in">
              <p className="text-[10px] font-medium text-app-text-muted">Preset Colors</p>
              <div className="grid grid-cols-5 gap-1.5">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    onClick={() => {
                      if (swatch.value === 'inherit') {
                        editor.chain().focus().unsetColor().run();
                      } else {
                        editor.chain().focus().setColor(swatch.value).run();
                      }
                      setShowColorPicker(false);
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

              {/* Custom Color Input */}
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

        <div className="w-px h-4 bg-app-border mx-0.5" />

        {/* Clear formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="p-1.5 rounded-lg text-xs text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors"
          title="Clear Formatting"
        >
          <RemoveFormatting className="w-3.5 h-3.5" />
        </button>

        {/* Quick Insert Drawing & Image actions right in toolbar */}
        {onInsertDrawing && (
          <button
            type="button"
            onClick={onInsertDrawing}
            className="p-1.5 rounded-lg text-xs text-app-accent hover:bg-app-accent/10 transition-colors flex items-center gap-1 ml-auto font-medium"
            title="Insert S Pen Drawing Canvas below"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Draw</span>
          </button>
        )}

        {onInsertImage && (
          <button
            type="button"
            onClick={onInsertImage}
            className="p-1.5 rounded-lg text-xs text-emerald-500 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 font-medium"
            title="Insert Image below"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Image</span>
          </button>
        )}
      </div>

      {/* Editor Content Area: Clicking focuses the editor immediately */}
      <div
        onClick={() => editor.chain().focus().run()}
        className="prose dark:prose-invert max-w-none text-app-text leading-relaxed font-sans text-sm focus:outline-none min-h-[100px] px-2 py-1 cursor-text"
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

TextBlock.displayName = 'TextBlock';
