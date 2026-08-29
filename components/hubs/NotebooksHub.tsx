'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Notebook, Subject, Folder } from '@/types';
import { supabase, getCurrentUserId } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { MoveItemModal } from '@/components/modals/MoveItemModal';
import {
  Plus,
  BookOpen,
  Star,
  Trash2,
  FolderInput,
  Edit2,
  X,
  Check,
  Search,
  Folder as FolderIcon,
  Sparkles,
  Inbox,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotebooksHubProps {
  onOpenNotebook: (notebook: Notebook) => void;
}

export const NotebooksHub: React.FC<NotebooksHubProps> = ({ onOpenNotebook }) => {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string | 'all' | 'unassigned'>('all');

  // Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubjectId, setNewSubjectId] = useState<string | null>(null);
  const [newFolderId, setNewFolderId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Renaming State
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  // Move Modal State
  const [movingNotebook, setMovingNotebook] = useState<Notebook | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [nRes, sRes, fRes] = await Promise.all([
        supabase
          .from('notebooks')
          .select('*')
          .eq('is_deleted', false)
          .order('updated_at', { ascending: false }),
        supabase
          .from('subjects')
          .select('*')
          .eq('is_deleted', false)
          .order('name', { ascending: true }),
        supabase
          .from('folders')
          .select('*')
          .eq('is_deleted', false)
          .order('name', { ascending: true }),
      ]);

      if (nRes.error) throw nRes.error;
      if (sRes.error) throw sRes.error;
      if (fRes.error) throw fRes.error;

      if (nRes.data) setNotebooks(nRes.data);
      if (sRes.data) setSubjects(sRes.data);
      if (fRes.data) setFolders(fRes.data);
    } catch (err: any) {
      console.error('Error fetching notebooks hub data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create Notebook
  const handleCreateNotebook = async (e: React.FormEvent) => {
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

      // Insert Notebook
      const { data: nbData, error: nbError } = await supabase
        .from('notebooks')
        .insert([
          {
            user_id: userId,
            title: cleanTitle,
            subject_id: newSubjectId || null,
            folder_id: newFolderId || null,
            is_starred: false,
            is_deleted: false,
            default_template: 'ruled',
          },
        ])
        .select()
        .single();

      if (nbError) throw nbError;

      // Insert initial page 1
      await supabase.from('notebook_pages').insert([
        {
          user_id: userId,
          notebook_id: nbData.id,
          page_number: 1,
          title: 'Page 1',
          template: 'ruled',
          blocks: [
            {
              id: crypto.randomUUID(),
              type: 'text',
              content: { type: 'doc', content: [{ type: 'paragraph' }] },
            },
          ],
          is_deleted: false,
        },
      ]);

      setNewTitle('');
      setNewSubjectId(null);
      setNewFolderId(null);
      setIsCreating(false);
      setIsSubmitting(false);
      onOpenNotebook(nbData);
    } catch (err: any) {
      console.error('Failed to create notebook:', err);
      setErrorMsg(err?.message || 'Failed to create notebook in database.');
      setIsSubmitting(false);
    }
  };

  // Rename Notebook
  const handleSaveRename = async (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const cleanTitle = renameTitle.trim();
    if (!cleanTitle) return;

    setNotebooks((prev) =>
      prev.map((n) => (n.id === id ? { ...n, title: cleanTitle } : n))
    );
    setRenamingId(null);

    try {
      await supabase
        .from('notebooks')
        .update({ title: cleanTitle, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (err) {
      console.error('Failed to rename notebook:', err);
      fetchData();
    }
  };

  // Star / Unstar
  const handleToggleStar = async (nb: Notebook, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStarred = !nb.is_starred;

    setNotebooks((prev) =>
      prev.map((n) => (n.id === nb.id ? { ...n, is_starred: nextStarred } : n))
    );

    try {
      await supabase
        .from('notebooks')
        .update({ is_starred: nextStarred, updated_at: new Date().toISOString() })
        .eq('id', nb.id);
    } catch (err) {
      console.error('Failed to update star in Supabase:', err);
      fetchData();
    }
  };

  // Soft Delete Notebook (Moves to Recycle Bin)
  const handleDeleteNotebook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Move notebook to Recycle Bin?')) return;

    setNotebooks((prev) => prev.filter((n) => n.id !== id));

    try {
      await supabase
        .from('notebooks')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (err) {
      console.error('Failed to delete notebook:', err);
      fetchData();
    }
  };

  // Filtered notebooks
  const filteredNotebooks = useMemo(() => {
    return notebooks.filter((nb) => {
      // Subject filter
      if (selectedSubjectFilter === 'unassigned' && nb.subject_id) return false;
      if (selectedSubjectFilter !== 'all' && selectedSubjectFilter !== 'unassigned' && nb.subject_id !== selectedSubjectFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        return nb.title.toLowerCase().includes(searchQuery.toLowerCase().trim());
      }

      return true;
    });
  }, [notebooks, selectedSubjectFilter, searchQuery]);

  return (
    <div className="min-h-full flex flex-col bg-app-bg text-app-text theme-transition">
      {/* Top Header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-app-border">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-lg md:text-xl font-medium tracking-tight text-app-text">
            Notebooks
          </h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-app-surface text-app-accent border border-app-border">
            {filteredNotebooks.length} total
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-subtle"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New notebook</span>
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 max-w-7xl w-full mx-auto space-y-6">
        {/* Search & Subject Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-app-text-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notebooks by title..."
              className="w-full bg-app-surface border border-app-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-app-text-dim hover:text-app-text"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Subject Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 bg-app-surface p-1 rounded-xl border border-app-border text-xs">
            <button
              type="button"
              onClick={() => setSelectedSubjectFilter('all')}
              className={cn(
                'px-3 py-1 rounded-lg transition-colors font-medium shrink-0',
                selectedSubjectFilter === 'all'
                  ? 'bg-app-accent text-white'
                  : 'text-app-text-muted hover:text-app-text'
              )}
            >
              All ({notebooks.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedSubjectFilter('unassigned')}
              className={cn(
                'px-3 py-1 rounded-lg transition-colors font-medium shrink-0 flex items-center gap-1',
                selectedSubjectFilter === 'unassigned'
                  ? 'bg-app-accent text-white'
                  : 'text-app-text-muted hover:text-app-text'
              )}
            >
              <Inbox className="w-3 h-3" />
              <span>Unassigned ({notebooks.filter((n) => !n.subject_id).length})</span>
            </button>

            {subjects.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSubjectFilter(s.id)}
                className={cn(
                  'px-3 py-1 rounded-lg transition-colors font-medium shrink-0 flex items-center gap-1',
                  selectedSubjectFilter === s.id
                    ? 'bg-app-accent text-white'
                    : 'text-app-text-muted hover:text-app-text'
                )}
              >
                <Sparkles className="w-3 h-3 text-app-accent" />
                <span className="font-serif">{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notebooks Grid */}
        {filteredNotebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="p-4 rounded-2xl bg-app-surface border border-app-border text-app-accent">
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="font-serif text-base font-medium text-app-text">No notebooks found</h3>
              <p className="text-xs text-app-text-muted">
                {searchQuery || selectedSubjectFilter !== 'all'
                  ? 'Try clearing your search or filter to see more notebooks.'
                  : 'Create your first physical digital notebook to start writing.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 shadow-subtle"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New notebook</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotebooks.map((nb) => {
              const nbSubject = subjects.find((s) => s.id === nb.subject_id);
              const nbFolder = folders.find((f) => f.id === nb.folder_id);
              const isRenaming = renamingId === nb.id;

              return (
                <div
                  key={nb.id}
                  onClick={() => onOpenNotebook(nb)}
                  className="group p-5 rounded-2xl border border-app-border bg-app-surface/60 hover:bg-app-surface hover:border-app-accent/40 cursor-pointer transition-all shadow-subtle flex flex-col justify-between min-h-[140px]"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-app-bg text-app-accent border border-app-border shrink-0 group-hover:border-app-accent/30 transition-colors">
                        <BookOpen className="w-4 h-4" />
                      </div>

                      <div className="min-w-0">
                        {isRenaming ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={renameTitle}
                              onChange={(e) => setRenameTitle(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(nb.id, e)}
                              autoFocus
                              className="bg-app-bg border border-app-accent rounded-lg px-2 py-0.5 text-xs text-app-text outline-none font-serif"
                            />
                            <button
                              type="button"
                              onClick={(e) => handleSaveRename(nb.id, e)}
                              className="p-1 rounded bg-app-accent text-white"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <h3 className="font-serif text-base font-medium text-app-text truncate group-hover:text-app-accent transition-colors">
                            {nb.title}
                          </h3>
                        )}

                        {/* Subject & Folder Badges */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {nbSubject ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-app-accent bg-app-accent/10 px-1.5 py-0.5 rounded-md border border-app-accent/20">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[100px]">{nbSubject.name}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-app-text-dim">Unassigned</span>
                          )}

                          {nbFolder && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-app-text-muted bg-app-surface px-1.5 py-0.5 rounded-md border border-app-border">
                              <FolderIcon className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[100px]">{nbFolder.name}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Card Controls */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleStar(nb, e)}
                        className={cn(
                          'p-1 rounded text-app-text-muted hover:text-app-text',
                          nb.is_starred && 'text-app-accent opacity-100'
                        )}
                        title={nb.is_starred ? 'Unstar' : 'Star notebook'}
                      >
                        <Star className={cn('w-3.5 h-3.5', nb.is_starred && 'fill-current')} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(nb.id);
                          setRenameTitle(nb.title);
                        }}
                        className="p-1 rounded text-app-text-muted hover:text-app-text"
                        title="Rename notebook"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMovingNotebook(nb);
                        }}
                        className="p-1 rounded text-app-text-muted hover:text-app-text"
                        title="Move to..."
                      >
                        <FolderInput className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteNotebook(nb.id, e)}
                        className="p-1 rounded text-app-text-muted hover:text-rose-500"
                        title="Delete notebook"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-4 border-t border-app-border/40 flex items-center justify-between text-xs text-app-text-dim">
                    <span>
                      {new Date(nb.updated_at || nb.created_at || Date.now()).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="text-app-accent text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">
                      Open notebook →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CREATE NOTEBOOK MODAL */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-elevated p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-app-border pb-3">
              <h3 className="font-serif text-base font-medium text-app-text">New Notebook</h3>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="p-1 rounded text-app-text-muted hover:text-app-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateNotebook} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted">Notebook Title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Calculus Notes, Business Strategy"
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent font-serif"
                />
              </div>

              {/* Subject Selector */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted">Subject (optional)</label>
                <select
                  value={newSubjectId || ''}
                  onChange={(e) => {
                    const nextSubj = e.target.value || null;
                    setNewSubjectId(nextSubj);
                    setNewFolderId(null);
                  }}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-app-text outline-none focus:border-app-accent font-sans"
                >
                  <option value="">(No Subject - Unassigned)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Folder Selector (if subject selected) */}
              {newSubjectId && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted">Folder inside Subject (optional)</label>
                  <select
                    value={newFolderId || ''}
                    onChange={(e) => setNewFolderId(e.target.value || null)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-app-text outline-none focus:border-app-accent font-sans"
                  >
                    <option value="">(Subject Root - No Folder)</option>
                    {folders
                      .filter((f) => f.subject_id === newSubjectId)
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-app-border">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 text-xs text-app-text-muted hover:text-app-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Notebook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE NOTEBOOK MODAL */}
      {movingNotebook && (
        <MoveItemModal
          isOpen={true}
          onClose={() => setMovingNotebook(null)}
          itemType="notebook"
          itemId={movingNotebook.id}
          itemTitle={movingNotebook.title}
          currentSubjectId={movingNotebook.subject_id}
          currentFolderId={movingNotebook.folder_id}
          onMoved={fetchData}
        />
      )}
    </div>
  );
};
