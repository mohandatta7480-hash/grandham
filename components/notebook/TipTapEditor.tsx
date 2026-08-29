'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  Table as TableIcon,
  Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TipTapEditorProps {
  content: any;
  onChange: (content: any) => void;
  isEditable?: boolean;
  placeholder?: string;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  content,
  onChange,
  isEditable = true,
  placeholder = 'Start typing your notes, paste links, or switch to S Pen handwriting...',
}) => {
  const editor = useEditor({
    immediatelyRender: false,
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
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-cyan-400 underline decoration-cyan-400/50 hover:decoration-cyan-400 cursor-pointer',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    editable: isEditable,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
  });

  // Sync content when page changes
  useEffect(() => {
    if (editor && content) {
      const currentJSON = JSON.stringify(editor.getJSON());
      const newJSON = JSON.stringify(content);
      if (currentJSON !== newJSON) {
        editor.commands.setContent(content, false);
      }
    }
  }, [content, editor]);

  if (!editor) {
    return <div className="min-h-[400px] p-6 text-slate-500 animate-pulse">Loading note editor...</div>;
  }

  const addLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <div className="relative w-full z-10">
      {/* TipTap Floating Text Toolbar */}
      {isEditable && (
        <div className="flex flex-wrap items-center gap-0.5 p-1.5 mb-2 bg-dark-900/90 backdrop-blur-md border border-slate-800/80 rounded-xl max-w-fit shadow-md">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('bold') ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('italic') ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('underline') ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('strike') ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Strikethrough"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('heading', { level: 1 }) ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Heading 1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('heading', { level: 2 }) ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Heading 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('heading', { level: 3 }) ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Heading 3"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('bulletList') ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('orderedList') ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Numbered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('taskList') ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Task Checklist"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('codeBlock') ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Code Block"
          >
            <Code className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('blockquote') ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Blockquote"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={insertTable}
            className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
            title="Insert Table (3x3)"
          >
            <TableIcon className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={addLink}
            className={cn(
              'p-1.5 rounded-lg text-xs transition-all',
              editor.isActive('link') ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            )}
            title="Add Link"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      <EditorContent editor={editor} className="w-full" />
    </div>
  );
};
