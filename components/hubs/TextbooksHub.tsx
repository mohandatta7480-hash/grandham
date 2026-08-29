'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Textbook } from '@/types';
import { supabase, getCurrentUserId } from '@/lib/supabase/client';
import { getPdfJs } from '@/lib/pdf/pdfViewerHelper';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import {
  Plus,
  GraduationCap,
  Star,
  Trash2,
  ChevronRight,
  BookOpen,
  Upload,
  Edit2,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TextbooksHubProps {
  onOpenTextbook: (textbook: Textbook) => void;
}

export const TextbooksHub: React.FC<TextbooksHubProps> = ({ onOpenTextbook }) => {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedTextbook, setSelectedTextbook] = useState<Textbook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Renaming State
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch textbooks from Supabase
  const fetchTextbooks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('textbooks')
        .select('*')
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setTextbooks(data);
        if (!selectedTextbook && data.length > 0) {
          setSelectedTextbook(data[0]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching textbooks from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTextbook]);

  useEffect(() => {
    fetchTextbooks();
  }, [fetchTextbooks]);

  // Handle PDF File Upload to Supabase Storage & Database
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please select a valid PDF file.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const userId = await getCurrentUserId();

      const cleanTitle = file.name.replace(/\.pdf$/i, '').trim();
      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // 1. Upload to Supabase Storage bucket 'textbooks'
      let fileUrl = '';
      const { error: uploadError } = await supabase.storage
        .from('textbooks')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Storage bucket upload issue, converting to DataURL fallback:', uploadError);
        // Fallback to DataURL
        const reader = new FileReader();
        fileUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      } else {
        const { data: urlData } = supabase.storage
          .from('textbooks')
          .getPublicUrl(filePath);
        fileUrl = urlData?.publicUrl || '';
      }

      // 2. Extract page count with PDF.js
      let pageCount = 1;
      try {
        const pdfjs = await getPdfJs();
        if (pdfjs && fileUrl) {
          const loadingTask = pdfjs.getDocument(fileUrl);
          const doc = await loadingTask.promise;
          pageCount = doc.numPages;
        }
      } catch (pdfErr) {
        console.warn('Could not extract PDF page count:', pdfErr);
      }

      // 3. Insert record into Supabase
      const { data: supaTb, error: supaErr } = await supabase
        .from('textbooks')
        .insert([
          {
            user_id: userId,
            title: cleanTitle,
            file_path: filePath || null,
            file_url: fileUrl || null,
            file_name: file.name,
            page_count: pageCount,
            current_page: 1,
            annotations: {},
            is_starred: false,
            is_deleted: false,
          },
        ])
        .select()
        .single();

      if (supaErr) throw supaErr;

      if (supaTb) {
        setTextbooks((prev) => [supaTb, ...prev]);
        setSelectedTextbook(supaTb);
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Failed to upload textbook to Supabase:', err);
      setUploadError(err?.message || 'Failed to upload PDF.');
    } finally {
      setIsUploading(false);
    }
  };

  // Rename Textbook
  const handleSaveRename = async (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const cleanTitle = renameTitle.trim();
    if (!cleanTitle) return;

    setTextbooks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: cleanTitle } : t))
    );
    if (selectedTextbook?.id === id) {
      setSelectedTextbook({ ...selectedTextbook, title: cleanTitle });
    }
    setRenamingId(null);

    try {
      const { error } = await supabase
        .from('textbooks')
        .update({ title: cleanTitle, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to rename textbook:', err);
      fetchTextbooks();
    }
  };

  // Star / Unstar
  const handleToggleStar = async (tb: Textbook, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStarred = !tb.is_starred;

    setTextbooks((prev) =>
      prev.map((t) => (t.id === tb.id ? { ...t, is_starred: nextStarred } : t))
    );
    if (selectedTextbook?.id === tb.id) {
      setSelectedTextbook({ ...selectedTextbook, is_starred: nextStarred });
    }

    try {
      const { error } = await supabase
        .from('textbooks')
        .update({ is_starred: nextStarred, updated_at: new Date().toISOString() })
        .eq('id', tb.id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update star in Supabase:', err);
      fetchTextbooks();
    }
  };

  // Soft Delete Textbook (Moves to Recycle Bin)
  const handleDeleteTextbook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Move textbook to Recycle Bin?')) return;

    setTextbooks((prev) => prev.filter((t) => t.id !== id));
    if (selectedTextbook?.id === id) {
      setSelectedTextbook(textbooks.find((t) => t.id !== id) || null);
    }

    try {
      const { error } = await supabase
        .from('textbooks')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete textbook:', err);
      fetchTextbooks();
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-app-bg text-app-text theme-transition">
      {/* Hidden File Input for PDF */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/pdf"
        className="hidden"
      />

      {/* Top Header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-app-border">
        <h1 className="font-serif text-lg md:text-xl font-medium tracking-tight text-app-text">
          Textbooks
        </h1>
        <div className="flex items-center gap-3">
          {textbooks.length > 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-surface hover:bg-app-surface-hover border border-app-border text-xs font-medium text-app-text transition-colors shadow-subtle disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5 text-app-accent" />
              <span>{isUploading ? 'Uploading to Supabase...' : 'Add textbook'}</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-6 md:p-12 max-w-6xl w-full mx-auto space-y-4">
        {uploadError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium max-w-md">
            {uploadError}
          </div>
        )}

        {textbooks.length === 0 ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-app-surface border border-app-border flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-app-accent" />
            </div>
            <div className="space-y-1">
              <p className="font-serif text-base text-app-text font-medium">
                No textbooks added yet.
              </p>
              <p className="text-xs text-app-text-muted">
                Import PDF textbooks and study documents to annotate with S Pen or touch.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-subtle disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Uploading to Supabase...' : 'Add textbook'}</span>
            </button>
          </div>
        ) : (
          /* Left-Side List + Detail View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
            {/* Left-Side List */}
            <div className="lg:col-span-5 flex flex-col space-y-3">
              <span className="text-[11px] font-mono uppercase tracking-widest text-app-accent font-medium">
                Recent Textbooks
              </span>
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {textbooks.map((tb) => {
                  const isSelected = selectedTextbook?.id === tb.id;
                  const isRenaming = renamingId === tb.id;

                  return (
                    <div
                      key={tb.id}
                      onClick={() => setSelectedTextbook(tb)}
                      className={cn(
                        'group p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2',
                        isSelected
                          ? 'bg-app-surface border-app-accent/60 shadow-subtle'
                          : 'bg-app-surface/60 border-app-border hover:border-app-border-strong hover:bg-app-surface'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {isRenaming ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 flex-1"
                          >
                            <input
                              type="text"
                              autoFocus
                              value={renameTitle}
                              onChange={(e) => setRenameTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(tb.id, e);
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              className="bg-app-bg border border-app-border rounded px-2 py-0.5 text-xs text-app-text outline-none focus:border-app-accent w-full"
                            />
                            <button
                              type="button"
                              onClick={(e) => handleSaveRename(tb.id, e)}
                              className="p-1 text-app-accent hover:opacity-80"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <h3 className="text-xs font-medium text-app-text line-clamp-1">
                            {tb.title}
                          </h3>
                        )}

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingId(tb.id);
                              setRenameTitle(tb.title);
                            }}
                            className="p-0.5 text-app-text-dim hover:text-app-text opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Rename"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleToggleStar(tb, e)}
                            className="p-0.5 text-app-text-dim hover:text-app-accent transition-colors"
                            title={tb.is_starred ? 'Unstar' : 'Star'}
                          >
                            <Star
                              className={cn(
                                'w-3.5 h-3.5',
                                tb.is_starred ? 'fill-app-accent text-app-accent' : ''
                              )}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTextbook(tb.id, e)}
                            className="p-0.5 text-app-text-dim hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Move to Recycle Bin"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-app-text-muted">
                        <span>{tb.page_count || tb.pageCount ? `${tb.page_count || tb.pageCount} pages` : 'PDF'}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenTextbook(tb);
                          }}
                          className="text-app-accent hover:underline flex items-center gap-0.5"
                        >
                          Open reader <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Detail Panel */}
            <div className="lg:col-span-7 flex flex-col rounded-2xl bg-app-surface border border-app-border p-6 shadow-subtle justify-between">
              {selectedTextbook ? (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-app-accent">
                      Selected Document
                    </span>
                    <h2 className="font-serif text-lg font-medium text-app-text">
                      {selectedTextbook.title}
                    </h2>
                  </div>

                  <div className="p-6 rounded-xl border border-dashed border-app-border bg-app-bg text-center space-y-3">
                    <p className="text-xs text-app-text-muted">
                      Ready for S Pen handwriting, touch annotation, and page reading.
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenTextbook(selectedTextbook)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Open PDF Reader & Annotator</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-app-text-dim font-serif italic">
                  Select a textbook to view.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
