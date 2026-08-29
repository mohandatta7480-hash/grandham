'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Subject, Folder, Notebook } from '@/types';
import { supabase, getCurrentUserId } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { MoveItemModal } from '@/components/modals/MoveItemModal';
import {
  Plus,
  BookOpen,
  Folder as FolderIcon,
  ArrowLeft,
  Trash2,
  ChevronRight,
  Edit2,
  Check,
  X,
  Star,
  FolderInput,
  FolderPlus,
  Sparkles,
  Inbox,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubjectsHubProps {
  onOpenNotebook: (notebook: Notebook) => void;
}

export const SubjectsHub: React.FC<SubjectsHubProps> = ({ onOpenNotebook }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [activeFolderFilter, setActiveFolderFilter] = useState<string | 'all' | 'root'>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Subject Creation & Rename
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [renamingSubjectId, setRenamingSubjectId] = useState<string | null>(null);
  const [renameSubjectName, setRenameSubjectName] = useState('');

  // Folder Creation & Rename
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');

  // Notebook Creation inside Subject
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [createTargetFolderId, setCreateTargetFolderId] = useState<string | null>(null);

  // Move Modal State
  const [moveModalItem, setMoveModalItem] = useState<{
    type: 'notebook' | 'folder';
    id: string;
    title: string;
    subjectId?: string | null;
    folderId?: string | null;
  } | null>(null);

  // Drag & drop state
  const [draggingNotebookId, setDraggingNotebookId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sRes, fRes, nRes] = await Promise.all([
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
        supabase
          .from('notebooks')
          .select('*')
          .eq('is_deleted', false)
          .order('updated_at', { ascending: false }),
      ]);

      if (sRes.error) throw sRes.error;
      if (fRes.error) throw fRes.error;
      if (nRes.error) throw nRes.error;

      if (sRes.data) setSubjects(sRes.data);
      if (fRes.data) setFolders(fRes.data);
      if (nRes.data) setNotebooks(nRes.data);
    } catch (err: any) {
      console.error('Error fetching subjects/folders from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create Subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSubjectName.trim();
    if (!name) return;

    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('subjects')
        .insert([{ user_id: userId, name, is_deleted: false }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setSubjects((prev) => [...prev, data]);
        setNewSubjectName('');
        setIsCreatingSubject(false);
        setSelectedSubject(data);
      }
    } catch (err: any) {
      console.error('Failed to create subject:', err);
      setErrorMsg(err?.message || 'Failed to create subject.');
    }
  };

  // Rename Subject
  const handleSaveRenameSubject = async (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const clean = renameSubjectName.trim();
    if (!clean) return;

    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, name: clean } : s)));
    if (selectedSubject?.id === id) {
      setSelectedSubject({ ...selectedSubject, name: clean });
    }
    setRenamingSubjectId(null);

    try {
      await supabase
        .from('subjects')
        .update({ name: clean, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (err) {
      console.error('Failed to rename subject:', err);
      fetchData();
    }
  };

  // Delete Subject (Soft delete)
  const handleDeleteSubject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Move subject to Recycle Bin? Notebooks inside will remain safe.')) return;

    setSubjects((prev) => prev.filter((s) => s.id !== id));
    if (selectedSubject?.id === id) {
      setSelectedSubject(null);
    }

    try {
      await supabase
        .from('subjects')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (err) {
      console.error('Failed to delete subject:', err);
      fetchData();
    }
  };

  // Create Folder inside Subject
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    const name = newFolderName.trim();
    if (!name) return;

    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from('folders')
        .insert([
          {
            user_id: userId,
            subject_id: selectedSubject.id,
            name,
            is_deleted: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setFolders((prev) => [...prev, data]);
        setNewFolderName('');
        setIsCreatingFolder(false);
      }
    } catch (err: any) {
      console.error('Failed to create folder:', err);
      setErrorMsg(err?.message || 'Failed to create folder.');
    }
  };

  // Rename Folder
  const handleSaveRenameFolder = async (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const clean = renameFolderName.trim();
    if (!clean) return;

    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: clean } : f)));
    setRenamingFolderId(null);

    try {
      await supabase
        .from('folders')
        .update({ name: clean, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (err) {
      console.error('Failed to rename folder:', err);
      fetchData();
    }
  };

  // Delete Folder (Soft delete)
  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Move folder to Recycle Bin? Notebooks inside will be moved to the subject root.')) return;

    setFolders((prev) => prev.filter((f) => f.id !== id));

    try {
      await supabase
        .from('folders')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      // Detach notebooks from this folder
      await supabase
        .from('notebooks')
        .update({ folder_id: null, updated_at: new Date().toISOString() })
        .eq('folder_id', id);

      fetchData();
    } catch (err) {
      console.error('Failed to delete folder:', err);
      fetchData();
    }
  };

  // Create Notebook in Subject / Folder
  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    const title = newNotebookTitle.trim();
    if (!title) return;

    try {
      const userId = await getCurrentUserId();
      const { data: nbData, error: nbError } = await supabase
        .from('notebooks')
        .insert([
          {
            user_id: userId,
            title,
            subject_id: selectedSubject.id,
            folder_id: createTargetFolderId || null,
            is_starred: false,
            is_deleted: false,
            default_template: 'ruled',
          },
        ])
        .select()
        .single();

      if (nbError) throw nbError;

      // Page 1
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

      setNotebooks((prev) => [nbData, ...prev]);
      setNewNotebookTitle('');
      setIsCreatingNotebook(false);
      onOpenNotebook(nbData);
    } catch (err: any) {
      console.error('Failed to create notebook in subject:', err);
      setErrorMsg(err?.message || 'Failed to create notebook.');
    }
  };

  // Delete Notebook (Soft delete)
  const handleDeleteNotebook = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Move notebook to Recycle Bin?')) return;

    setNotebooks((prev) => prev.filter((n) => n.id !== id));
    try {
      await supabase
        .from('notebooks')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (e) {
      console.error('Failed to delete notebook:', e);
      fetchData();
    }
  };

  // Star / Unstar
  const handleToggleStar = async (nb: Notebook, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !nb.is_starred;
    setNotebooks((prev) => prev.map((n) => (n.id === nb.id ? { ...n, is_starred: next } : n)));

    try {
      await supabase
        .from('notebooks')
        .update({ is_starred: next, updated_at: new Date().toISOString() })
        .eq('id', nb.id);
    } catch (e) {
      console.error('Failed to toggle star:', e);
    }
  };

  // Drag & drop drop handler
  const handleDropOnFolder = async (folderId: string | null) => {
    if (!draggingNotebookId) return;

    const targetNbId = draggingNotebookId;
    setDraggingNotebookId(null);
    setDragOverFolderId(null);

    setNotebooks((prev) =>
      prev.map((n) => (n.id === targetNbId ? { ...n, folder_id: folderId } : n))
    );

    try {
      await supabase
        .from('notebooks')
        .update({ folder_id: folderId, updated_at: new Date().toISOString() })
        .eq('id', targetNbId);
    } catch (e) {
      console.error('Failed to update notebook folder:', e);
      fetchData();
    }
  };

  // Filtered notebooks for current view
  const currentSubjectFolders = selectedSubject
    ? folders.filter((f) => f.subject_id === selectedSubject.id)
    : [];

  const currentSubjectNotebooks = selectedSubject
    ? notebooks.filter((n) => n.subject_id === selectedSubject.id)
    : [];

  const visibleNotebooks = currentSubjectNotebooks.filter((n) => {
    if (activeFolderFilter === 'all') return true;
    if (activeFolderFilter === 'root') return !n.folder_id;
    return n.folder_id === activeFolderFilter;
  });

  return (
    <div className="min-h-full flex flex-col bg-app-bg text-app-text theme-transition">
      {/* Top Header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-app-border">
        <div className="flex items-center gap-3">
          {selectedSubject && (
            <button
              type="button"
              onClick={() => {
                setSelectedSubject(null);
                setActiveFolderFilter('all');
              }}
              className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors"
              title="Back to all subjects"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2">
            <h1 className="font-serif text-lg md:text-xl font-medium tracking-tight text-app-text">
              {selectedSubject ? selectedSubject.name : 'Subjects'}
            </h1>
            {selectedSubject && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-app-surface text-app-accent border border-app-border">
                {currentSubjectNotebooks.length} notes
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedSubject ? (
            <>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-app-surface hover:bg-app-surface-hover border border-app-border text-xs font-medium text-app-text transition-colors shadow-subtle"
              >
                <FolderPlus className="w-3.5 h-3.5 text-app-accent" />
                <span>New folder</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreateTargetFolderId(activeFolderFilter !== 'all' && activeFolderFilter !== 'root' ? activeFolderFilter : null);
                  setIsCreatingNotebook(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-subtle"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New notebook</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreatingSubject(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-subtle"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create subject</span>
            </button>
          )}

          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-12 max-w-7xl w-full mx-auto space-y-8">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
            {errorMsg}
          </div>
        )}

        {/* VIEW 1: ALL SUBJECTS GRID */}
        {!selectedSubject && (
          <div className="space-y-6">
            <div className="space-y-1">
              <p className="text-xs text-app-text-muted font-sans">
                Top-level study areas organizing your folders and notebooks.
              </p>
            </div>

            {subjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="p-4 rounded-2xl bg-app-surface border border-app-border text-app-accent">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="font-serif text-base font-medium text-app-text">No subjects yet</h3>
                  <p className="text-xs text-app-text-muted">
                    Create your first subject, like “Business Studies” or “Marketing”, to organize your notebooks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingSubject(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 shadow-subtle"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create subject</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects.map((subj) => {
                  const sFolders = folders.filter((f) => f.subject_id === subj.id);
                  const sNotebooks = notebooks.filter((n) => n.subject_id === subj.id);
                  const isRenaming = renamingSubjectId === subj.id;

                  return (
                    <div
                      key={subj.id}
                      onClick={() => setSelectedSubject(subj)}
                      className="group p-5 rounded-2xl border border-app-border bg-app-surface/60 hover:bg-app-surface hover:border-app-accent/40 cursor-pointer transition-all shadow-subtle flex flex-col justify-between min-h-[140px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 rounded-xl bg-app-accent/10 text-app-accent shrink-0">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          {isRenaming ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={renameSubjectName}
                                onChange={(e) => setRenameSubjectName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameSubject(subj.id, e)}
                                autoFocus
                                className="bg-app-bg border border-app-accent rounded-lg px-2 py-0.5 text-xs text-app-text outline-none font-serif"
                              />
                              <button
                                type="button"
                                onClick={(e) => handleSaveRenameSubject(subj.id, e)}
                                className="p-1 rounded bg-app-accent text-white"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <h3 className="font-serif text-base font-medium text-app-text truncate group-hover:text-app-accent transition-colors">
                              {subj.name}
                            </h3>
                          )}
                        </div>

                        {/* Subject Actions */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingSubjectId(subj.id);
                              setRenameSubjectName(subj.name);
                            }}
                            className="p-1 rounded text-app-text-muted hover:text-app-text hover:bg-app-bg"
                            title="Rename Subject"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSubject(subj.id, e)}
                            className="p-1 rounded text-app-text-muted hover:text-rose-500 hover:bg-app-bg"
                            title="Delete Subject"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div className="pt-4 border-t border-app-border/40 flex items-center justify-between text-xs text-app-text-muted">
                        <div className="flex items-center gap-3">
                          <span>{sFolders.length} folders</span>
                          <span>•</span>
                          <span>{sNotebooks.length} notebooks</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-app-text-dim group-hover:text-app-accent group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: INSIDE SELECTED SUBJECT (FOLDERS & NOTEBOOKS) */}
        {selectedSubject && (
          <div className="space-y-8">
            {/* Folders Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
                  Folders ({currentSubjectFolders.length})
                </h3>
              </div>

              {currentSubjectFolders.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-app-border text-center text-xs text-app-text-dim">
                  No folders yet. Click <span className="text-app-accent font-medium">+ New folder</span> above to group notebooks.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {currentSubjectFolders.map((folder) => {
                    const fNotes = currentSubjectNotebooks.filter((n) => n.folder_id === folder.id);
                    const isFilterActive = activeFolderFilter === folder.id;
                    const isRenaming = renamingFolderId === folder.id;
                    const isDragOver = dragOverFolderId === folder.id;

                    return (
                      <div
                        key={folder.id}
                        onClick={() => setActiveFolderFilter(isFilterActive ? 'all' : folder.id)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverFolderId(folder.id);
                        }}
                        onDragLeave={() => setDragOverFolderId(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDropOnFolder(folder.id);
                        }}
                        className={cn(
                          'group p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[90px]',
                          isFilterActive
                            ? 'border-app-accent bg-app-accent/10 shadow-subtle'
                            : 'border-app-border bg-app-surface/60 hover:bg-app-surface',
                          isDragOver && 'border-app-accent ring-2 ring-app-accent/30 scale-105 bg-app-accent/20'
                        )}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <FolderIcon className={cn('w-4 h-4 shrink-0', isFilterActive ? 'text-app-accent' : 'text-app-text-muted')} />
                            {isRenaming ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={renameFolderName}
                                  onChange={(e) => setRenameFolderName(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleSaveRenameFolder(folder.id, e)}
                                  autoFocus
                                  className="bg-app-bg border border-app-accent rounded px-1.5 py-0.5 text-xs text-app-text outline-none font-sans"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => handleSaveRenameFolder(folder.id, e)}
                                  className="p-0.5 rounded bg-app-accent text-white"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs font-medium text-app-text truncate">{folder.name}</p>
                            )}
                          </div>

                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingFolderId(folder.id);
                                setRenameFolderName(folder.name);
                              }}
                              className="p-1 rounded text-app-text-muted hover:text-app-text"
                              title="Rename folder"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setMoveModalItem({
                                type: 'folder',
                                id: folder.id,
                                title: folder.name,
                                subjectId: folder.subject_id,
                              })}
                              className="p-1 rounded text-app-text-muted hover:text-app-text"
                              title="Move folder to another subject"
                            >
                              <FolderInput className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteFolder(folder.id, e)}
                              className="p-1 rounded text-app-text-muted hover:text-rose-500"
                              title="Delete folder"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="pt-2 text-[11px] text-app-text-muted flex items-center justify-between">
                          <span>{fNotes.length} notes</span>
                          {isFilterActive && <span className="text-app-accent text-[10px] font-medium">Active filter</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Filter Tabs & Notebooks Section */}
            <div className="space-y-4 pt-4 border-t border-app-border">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1 bg-app-surface p-1 rounded-xl border border-app-border text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveFolderFilter('all')}
                    className={cn(
                      'px-3 py-1 rounded-lg transition-colors font-medium',
                      activeFolderFilter === 'all'
                        ? 'bg-app-accent text-white'
                        : 'text-app-text-muted hover:text-app-text'
                    )}
                  >
                    All Notes ({currentSubjectNotebooks.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveFolderFilter('root')}
                    className={cn(
                      'px-3 py-1 rounded-lg transition-colors font-medium',
                      activeFolderFilter === 'root'
                        ? 'bg-app-accent text-white'
                        : 'text-app-text-muted hover:text-app-text'
                    )}
                  >
                    Subject Root ({currentSubjectNotebooks.filter((n) => !n.folder_id).length})
                  </button>

                  {currentSubjectFolders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setActiveFolderFilter(f.id)}
                      className={cn(
                        'px-3 py-1 rounded-lg transition-colors font-medium flex items-center gap-1',
                        activeFolderFilter === f.id
                          ? 'bg-app-accent text-white'
                          : 'text-app-text-muted hover:text-app-text'
                      )}
                    >
                      <FolderIcon className="w-3 h-3" />
                      <span>{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notebooks Grid */}
              {visibleNotebooks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <BookOpen className="w-8 h-8 text-app-text-dim" />
                  <p className="text-xs text-app-text-muted">No notebooks found in this view.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateTargetFolderId(activeFolderFilter !== 'all' && activeFolderFilter !== 'root' ? activeFolderFilter : null);
                      setIsCreatingNotebook(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-app-accent text-white text-xs font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create notebook</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleNotebooks.map((nb) => {
                    const nbFolder = folders.find((f) => f.id === nb.folder_id);

                    return (
                      <div
                        key={nb.id}
                        draggable
                        onDragStart={() => setDraggingNotebookId(nb.id)}
                        onDragEnd={() => setDraggingNotebookId(null)}
                        onClick={() => onOpenNotebook(nb)}
                        className="group p-4 rounded-2xl border border-app-border bg-app-surface/60 hover:bg-app-surface hover:border-app-accent/40 cursor-pointer transition-all shadow-subtle flex flex-col justify-between min-h-[120px]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 rounded-xl bg-app-bg text-app-accent border border-app-border shrink-0">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-serif text-sm font-medium text-app-text truncate group-hover:text-app-accent transition-colors">
                                {nb.title}
                              </h4>
                              {nbFolder && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-app-text-muted mt-0.5">
                                  <FolderIcon className="w-2.5 h-2.5" />
                                  <span className="truncate max-w-[120px]">{nbFolder.name}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleToggleStar(nb, e)}
                              className={cn(
                                'p-1 rounded transition-colors',
                                nb.is_starred ? 'text-app-accent' : 'text-app-text-dim hover:text-app-text'
                              )}
                              title={nb.is_starred ? 'Unstar' : 'Star'}
                            >
                              <Star className={cn('w-3.5 h-3.5', nb.is_starred && 'fill-current')} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setMoveModalItem({
                                type: 'notebook',
                                id: nb.id,
                                title: nb.title,
                                subjectId: nb.subject_id,
                                folderId: nb.folder_id,
                              })}
                              className="p-1 rounded text-app-text-dim hover:text-app-text"
                              title="Move notebook..."
                            >
                              <FolderInput className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleDeleteNotebook(nb.id, e)}
                              className="p-1 rounded text-app-text-dim hover:text-rose-500"
                              title="Delete notebook"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-app-border/40 flex items-center justify-between text-[11px] text-app-text-dim">
                          <span>Updated {new Date(nb.updated_at || nb.created_at || Date.now()).toLocaleDateString()}</span>
                          <span className="text-app-accent text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Open →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* CREATE SUBJECT MODAL */}
      {isCreatingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-elevated p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-app-border pb-3">
              <h3 className="font-serif text-base font-medium text-app-text">Create Subject</h3>
              <button
                type="button"
                onClick={() => setIsCreatingSubject(false)}
                className="p-1 rounded text-app-text-muted hover:text-app-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted">Subject Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="e.g. Business Studies, Calculus, Chemistry"
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingSubject(false)}
                  className="px-3.5 py-2 text-xs text-app-text-muted hover:text-app-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90"
                >
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      {isCreatingFolder && selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-elevated p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-app-border pb-3">
              <h3 className="font-serif text-base font-medium text-app-text">
                New Folder in {selectedSubject.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="p-1 rounded text-app-text-muted hover:text-app-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted">Folder Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Unit 1 - Introduction, Formulas, Notes"
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-3.5 py-2 text-xs text-app-text-muted hover:text-app-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NOTEBOOK MODAL */}
      {isCreatingNotebook && selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-app-surface border border-app-border rounded-2xl shadow-elevated p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-app-border pb-3">
              <h3 className="font-serif text-base font-medium text-app-text">
                New Notebook in {selectedSubject.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingNotebook(false)}
                className="p-1 rounded text-app-text-muted hover:text-app-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNotebook} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted">Notebook Title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newNotebookTitle}
                  onChange={(e) => setNewNotebookTitle(e.target.value)}
                  placeholder="e.g. Chapter 1 Notes, Study Guide"
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent font-serif"
                />
              </div>

              {currentSubjectFolders.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted">Place in folder (optional)</label>
                  <select
                    value={createTargetFolderId || ''}
                    onChange={(e) => setCreateTargetFolderId(e.target.value || null)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3 py-2 text-xs text-app-text outline-none focus:border-app-accent"
                  >
                    <option value="">(Subject Root - No Folder)</option>
                    {currentSubjectFolders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNotebook(false)}
                  className="px-3.5 py-2 text-xs text-app-text-muted hover:text-app-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90"
                >
                  Create & Open
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE ITEM MODAL */}
      {moveModalItem && (
        <MoveItemModal
          isOpen={true}
          onClose={() => setMoveModalItem(null)}
          itemType={moveModalItem.type}
          itemId={moveModalItem.id}
          itemTitle={moveModalItem.title}
          currentSubjectId={moveModalItem.subjectId}
          currentFolderId={moveModalItem.folderId}
          onMoved={fetchData}
        />
      )}
    </div>
  );
};
