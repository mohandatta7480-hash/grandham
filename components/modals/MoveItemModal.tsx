'use client';

import React, { useState, useEffect } from 'react';
import { Subject, Folder, Notebook } from '@/types';
import { supabase, getCurrentUserId } from '@/lib/supabase/client';
import {
  Folder as FolderIcon,
  BookOpen,
  X,
  Check,
  ChevronRight,
  FolderPlus,
  Sparkles,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoveItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'notebook' | 'folder';
  itemId: string;
  itemTitle: string;
  currentSubjectId?: string | null;
  currentFolderId?: string | null;
  onMoved: () => void;
}

export const MoveItemModal: React.FC<MoveItemModalProps> = ({
  isOpen,
  onClose,
  itemType,
  itemId,
  itemTitle,
  currentSubjectId,
  currentFolderId,
  onMoved,
}) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(currentSubjectId || null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId || null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedSubjectId(currentSubjectId || null);
    setSelectedFolderId(currentFolderId || null);
    setErrorMsg(null);

    const loadTree = async () => {
      try {
        setIsLoading(true);
        const { data: sData } = await supabase
          .from('subjects')
          .select('*')
          .eq('is_deleted', false)
          .order('name', { ascending: true });

        const { data: fData } = await supabase
          .from('folders')
          .select('*')
          .eq('is_deleted', false)
          .order('name', { ascending: true });

        if (sData) setSubjects(sData);
        if (fData) setFolders(fData);
      } catch (err: any) {
        console.error('Error loading subjects/folders for move:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTree();
  }, [isOpen, currentSubjectId, currentFolderId]);

  if (!isOpen) return null;

  const handleMove = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (itemType === 'notebook') {
        const { error } = await supabase
          .from('notebooks')
          .update({
            subject_id: selectedSubjectId,
            folder_id: selectedFolderId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId);

        if (error) throw error;
      } else if (itemType === 'folder') {
        if (!selectedSubjectId) {
          setErrorMsg('A folder must belong to a Subject.');
          setIsSubmitting(false);
          return;
        }

        const { error } = await supabase
          .from('folders')
          .update({
            subject_id: selectedSubjectId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId);

        if (error) throw error;
      }

      onMoved();
      onClose();
    } catch (err: any) {
      console.error('Failed to move item:', err);
      setErrorMsg(err?.message || 'Failed to move item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-elevated overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <div className="flex items-center gap-2">
            {itemType === 'notebook' ? (
              <BookOpen className="w-4 h-4 text-app-accent" />
            ) : (
              <FolderIcon className="w-4 h-4 text-app-accent" />
            )}
            <div>
              <h3 className="text-sm font-medium text-app-text">
                Move {itemType === 'notebook' ? 'Notebook' : 'Folder'}
              </h3>
              <p className="text-[11px] text-app-text-muted truncate max-w-[260px]">
                "{itemTitle}"
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
              {errorMsg}
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center text-xs text-app-text-muted animate-pulse">
              Loading destinations...
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-app-text-muted">Select destination:</p>

              {/* Unassigned Destination (Notebooks only) */}
              {itemType === 'notebook' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId(null);
                    setSelectedFolderId(null);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-xl border text-xs transition-all',
                    selectedSubjectId === null && selectedFolderId === null
                      ? 'border-app-accent bg-app-accent/10 text-app-accent font-medium shadow-subtle'
                      : 'border-app-border bg-app-bg text-app-text hover:bg-app-surface-hover'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Inbox className="w-4 h-4 text-app-text-muted" />
                    <span>Unassigned (No Subject)</span>
                  </div>
                  {selectedSubjectId === null && selectedFolderId === null && (
                    <Check className="w-4 h-4 text-app-accent" />
                  )}
                </button>
              )}

              {/* Subjects & Folders Tree */}
              {subjects.map((subj) => {
                const subjFolders = folders.filter((f) => f.subject_id === subj.id && (itemType !== 'folder' || f.id !== itemId));
                const isSubjSelected = selectedSubjectId === subj.id && selectedFolderId === null;

                return (
                  <div key={subj.id} className="space-y-1 rounded-xl border border-app-border bg-app-bg p-2">
                    {/* Subject Row */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubjectId(subj.id);
                        setSelectedFolderId(null);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all',
                        isSubjSelected
                          ? 'bg-app-accent/10 text-app-accent font-medium'
                          : 'text-app-text hover:bg-app-surface-hover'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-app-accent" />
                        <span className="font-serif">{subj.name}</span>
                        {itemType === 'notebook' && (
                          <span className="text-[10px] text-app-text-dim">(Subject Root)</span>
                        )}
                      </div>
                      {isSubjSelected && <Check className="w-3.5 h-3.5 text-app-accent" />}
                    </button>

                    {/* Folders inside Subject */}
                    {itemType === 'notebook' && subjFolders.length > 0 && (
                      <div className="pl-4 space-y-1 border-l border-app-border/60 ml-2 mt-1">
                        {subjFolders.map((folder) => {
                          const isFolderSelected = selectedSubjectId === subj.id && selectedFolderId === folder.id;
                          return (
                            <button
                              key={folder.id}
                              type="button"
                              onClick={() => {
                                setSelectedSubjectId(subj.id);
                                setSelectedFolderId(folder.id);
                              }}
                              className={cn(
                                'w-full flex items-center justify-between p-1.5 rounded-lg text-xs transition-all',
                                isFolderSelected
                                  ? 'bg-app-accent/10 text-app-accent font-medium'
                                  : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <FolderIcon className="w-3 h-3 text-app-text-dim" />
                                <span>{folder.name}</span>
                              </div>
                              {isFolderSelected && <Check className="w-3 h-3 text-app-accent" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {subjects.length === 0 && (
                <div className="p-4 text-center text-xs text-app-text-dim">
                  No subjects created yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-app-border flex items-center justify-end gap-2 bg-app-surface">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-2 text-xs text-app-text-muted hover:text-app-text rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMove}
            disabled={isSubmitting || isLoading}
            className="px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isSubmitting ? 'Moving...' : 'Move here'}
          </button>
        </div>
      </div>
    </div>
  );
};
