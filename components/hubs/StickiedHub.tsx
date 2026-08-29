'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Notebook } from '@/types';
import { supabase, getCurrentUserId } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import {
  Plus,
  Star,
  BookOpen,
  Trash2,
  ChevronRight,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StickiedHubProps {
  onOpenNotebook: (notebook: Notebook) => void;
}

export const StickiedHub: React.FC<StickiedHubProps> = ({ onOpenNotebook }) => {
  const [stickiedNotebooks, setStickiedNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Renaming State
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  // Fetch stickied notebooks from Supabase
  const fetchStickied = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('notebooks')
        .select('*')
        .eq('is_starred', true)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setStickiedNotebooks(data);
        if (!selectedNotebook && data.length > 0) {
          setSelectedNotebook(data[0]);
        }
      }
    } catch (err: any) {
      console.error('Error fetching stickied notebooks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedNotebook]);

  useEffect(() => {
    fetchStickied();
  }, [fetchStickied]);

  // Create Stickied Notebook
  const handleCreateStickied = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newTitle.trim();
    if (!cleanTitle) {
      setErrorMsg('Please enter a notebook title.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const userId = await getCurrentUserId();

      const { data, error } = await supabase
        .from('notebooks')
        .insert([
          {
            user_id: userId,
            title: cleanTitle,
            is_starred: true,
            is_deleted: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Page 1
      await supabase.from('notebook_pages').insert([
        {
          user_id: userId,
          notebook_id: data.id,
          page_number: 1,
          title: 'Page 1',
          template: 'ruled',
          typed_content: { type: 'doc', content: [{ type: 'paragraph' }] },
          drawing_strokes: [],
          is_deleted: false,
        },
      ]);

      if (data) {
        setStickiedNotebooks((prev) => [data, ...prev]);
        setSelectedNotebook(data);
        setNewTitle('');
        setIsCreating(false);
        setIsSubmitting(false);
      }
    } catch (err: any) {
      console.error('Failed to create stickied notebook:', err);
      setErrorMsg(err?.message || 'Failed to create stickied notebook.');
      setIsSubmitting(false);
    }
  };

  // Rename
  const handleSaveRename = async (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const cleanTitle = renameTitle.trim();
    if (!cleanTitle) return;

    setStickiedNotebooks((prev) =>
      prev.map((n) => (n.id === id ? { ...n, title: cleanTitle } : n))
    );
    if (selectedNotebook?.id === id) {
      setSelectedNotebook({ ...selectedNotebook, title: cleanTitle });
    }
    setRenamingId(null);

    try {
      const { error } = await supabase
        .from('notebooks')
        .update({ title: cleanTitle, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to rename notebook:', err);
      fetchStickied();
    }
  };

  // Unstar / Remove from Stickied
  const handleUnstar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStickiedNotebooks((prev) => prev.filter((n) => n.id !== id));
    if (selectedNotebook?.id === id) {
      setSelectedNotebook(stickiedNotebooks.find((n) => n.id !== id) || null);
    }

    try {
      const { error } = await supabase
        .from('notebooks')
        .update({ is_starred: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to unstar notebook:', err);
      fetchStickied();
    }
  };

  // Soft Delete Notebook (Moves to Recycle Bin)
  const handleDeleteNotebook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Move stickied notebook to Recycle Bin?')) return;

    setStickiedNotebooks((prev) => prev.filter((n) => n.id !== id));
    if (selectedNotebook?.id === id) {
      setSelectedNotebook(stickiedNotebooks.find((n) => n.id !== id) || null);
    }

    try {
      const { error } = await supabase
        .from('notebooks')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete notebook:', err);
      fetchStickied();
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-app-bg text-app-text theme-transition">
      {/* Top Header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-app-border">
        <h1 className="font-serif text-lg md:text-xl font-medium tracking-tight text-app-text">
          Stickied Notebooks
        </h1>
        <div className="flex items-center gap-3">
          {stickiedNotebooks.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsCreating(true);
                setErrorMsg(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-surface hover:bg-app-surface-hover border border-app-border text-xs font-medium text-app-text transition-colors shadow-subtle"
            >
              <Plus className="w-3.5 h-3.5 text-app-accent" />
              <span>New</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-6 md:p-12 max-w-6xl w-full mx-auto">
        {/* Creation Form Modal/Inline */}
        {isCreating && (
          <form
            onSubmit={handleCreateStickied}
            className="mb-8 p-4 rounded-xl bg-app-surface border border-app-border space-y-3 max-w-md shadow-subtle"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text">
                New stickied notebook
              </span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="p-1 text-app-text-muted hover:text-app-text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="text"
              required
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Notebook title..."
              className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-1.5 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors"
            />
            {errorMsg && (
              <p className="text-xs text-rose-500 font-medium">{errorMsg}</p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewTitle('');
                }}
                disabled={isSubmitting}
                className="px-2.5 py-1 text-xs text-app-text-muted hover:text-app-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1 bg-app-accent text-white rounded-md text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating in Supabase...' : 'Create'}
              </button>
            </div>
          </form>
        )}

        {stickiedNotebooks.length === 0 ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-app-surface border border-app-border flex items-center justify-center">
              <Star className="w-6 h-6 text-app-accent fill-app-accent/20" />
            </div>
            <div className="space-y-1">
              <p className="font-serif text-base text-app-text font-medium">
                No stickied notebooks yet.
              </p>
              <p className="text-xs text-app-text-muted">
                Pin your most important notes and active study materials here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-subtle"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create stickied notebook</span>
            </button>
          </div>
        ) : (
          /* Left-Side List of Stickied Notebooks + Detail View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
            {/* Left-Side List */}
            <div className="lg:col-span-5 flex flex-col space-y-3">
              <span className="text-[11px] font-mono uppercase tracking-widest text-app-accent font-medium">
                Recent Stickied
              </span>
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {stickiedNotebooks.map((nb) => {
                  const isSelected = selectedNotebook?.id === nb.id;
                  const isRenaming = renamingId === nb.id;

                  return (
                    <div
                      key={nb.id}
                      onClick={() => setSelectedNotebook(nb)}
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
                                if (e.key === 'Enter') handleSaveRename(nb.id, e);
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              className="bg-app-bg border border-app-border rounded px-2 py-0.5 text-xs text-app-text outline-none focus:border-app-accent w-full"
                            />
                            <button
                              type="button"
                              onClick={(e) => handleSaveRename(nb.id, e)}
                              className="p-1 text-app-accent hover:opacity-80"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <h3 className="text-xs font-medium text-app-text line-clamp-1">
                            {nb.title}
                          </h3>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingId(nb.id);
                              setRenameTitle(nb.title);
                            }}
                            className="p-0.5 text-app-text-dim hover:text-app-text opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Rename"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleUnstar(nb.id, e)}
                            className="p-0.5 text-app-accent hover:opacity-80 transition-opacity"
                            title="Unpin from stickied"
                          >
                            <Star className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteNotebook(nb.id, e)}
                            className="p-0.5 text-app-text-dim hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Move to Recycle Bin"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-end text-[10px] text-app-text-muted">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNotebook(nb);
                          }}
                          className="text-app-accent hover:underline flex items-center gap-0.5"
                        >
                          Open <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Action & Info Panel */}
            <div className="lg:col-span-7 flex flex-col rounded-2xl bg-app-surface border border-app-border p-6 shadow-subtle justify-between">
              {selectedNotebook ? (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-app-accent">
                      Stickied Material
                    </span>
                    <h2 className="font-serif text-lg font-medium text-app-text">
                      {selectedNotebook.title}
                    </h2>
                  </div>

                  <div className="p-6 rounded-xl border border-dashed border-app-border bg-app-bg text-center space-y-3">
                    <p className="text-xs text-app-text-muted">
                      Ready for multi-page writing, S Pen handwriting canvas, and rich study notes.
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenNotebook(selectedNotebook)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Open Notebook</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-app-text-dim font-serif italic">
                  Select a stickied notebook.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
