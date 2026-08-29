'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Notebook, Textbook, Subject, Folder, Assignment } from '@/types';
import { supabase } from '@/lib/supabase/client';
import {
  Trash2,
  RotateCcw,
  BookOpen,
  GraduationCap,
  Folder as FolderIcon,
  Tag,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const RecycleBinHub: React.FC = () => {
  const [deletedNotebooks, setDeletedNotebooks] = useState<Notebook[]>([]);
  const [deletedTextbooks, setDeletedTextbooks] = useState<Textbook[]>([]);
  const [deletedSubjects, setDeletedSubjects] = useState<Subject[]>([]);
  const [deletedFolders, setDeletedFolders] = useState<Folder[]>([]);
  const [deletedAssignments, setDeletedAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'notebooks' | 'textbooks' | 'subjects' | 'folders' | 'assignments'>('all');

  const fetchDeletedItems = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Notebooks
      const { data: nbs } = await supabase
        .from('notebooks')
        .select('*')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });
      if (nbs) setDeletedNotebooks(nbs);

      // 2. Textbooks
      const { data: tbs } = await supabase
        .from('textbooks')
        .select('*')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });
      if (tbs) setDeletedTextbooks(tbs);

      // 3. Subjects
      const { data: subs } = await supabase
        .from('subjects')
        .select('*')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });
      if (subs) setDeletedSubjects(subs);

      // 4. Folders
      const { data: flds } = await supabase
        .from('folders')
        .select('*')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });
      if (flds) setDeletedFolders(flds);

      // 5. Assignments
      const { data: asgs } = await supabase
        .from('assignments')
        .select('*')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });
      if (asgs) setDeletedAssignments(asgs);
    } catch (err) {
      console.error('Error fetching recycle bin items:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeletedItems();
  }, [fetchDeletedItems]);

  // Restore Item
  const handleRestore = async (type: 'notebook' | 'textbook' | 'subject' | 'folder' | 'assignment', id: string) => {
    try {
      const tableMap = {
        notebook: 'notebooks',
        textbook: 'textbooks',
        subject: 'subjects',
        folder: 'folders',
        assignment: 'assignments',
      };

      const { error } = await supabase
        .from(tableMap[type])
        .update({ is_deleted: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      fetchDeletedItems();
    } catch (err) {
      console.error(`Failed to restore ${type}:`, err);
    }
  };

  // Permanent Delete Item
  const handlePermanentDelete = async (type: 'notebook' | 'textbook' | 'subject' | 'folder' | 'assignment', id: string, title: string) => {
    if (!window.confirm(`Permanently delete "${title}"? This cannot be undone.`)) return;

    try {
      const tableMap = {
        notebook: 'notebooks',
        textbook: 'textbooks',
        subject: 'subjects',
        folder: 'folders',
        assignment: 'assignments',
      };

      const { error } = await supabase
        .from(tableMap[type])
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchDeletedItems();
    } catch (err) {
      console.error(`Failed to permanently delete ${type}:`, err);
    }
  };

  const totalCount =
    deletedNotebooks.length +
    deletedTextbooks.length +
    deletedSubjects.length +
    deletedFolders.length +
    deletedAssignments.length;

  return (
    <div className="min-h-full flex flex-col bg-app-bg text-app-text theme-transition">
      {/* Top Header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-app-border">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-lg md:text-xl font-medium tracking-tight text-app-text">
            Recycle Bin
          </h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-app-surface border border-app-border text-app-accent font-semibold">
            {totalCount}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 px-6 md:px-12 py-8 max-w-5xl w-full mx-auto space-y-6">
        {totalCount === 0 && !isLoading ? (
          <div className="p-16 rounded-3xl border border-app-border bg-app-surface/50 text-center space-y-2 shadow-subtle">
            <Trash2 className="w-8 h-8 text-app-text-dim mx-auto" />
            <p className="font-serif text-sm text-app-text-dim italic">
              Recycle bin is empty.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Deleted Items List */}
            {deletedAssignments.map((asg) => (
              <div
                key={asg.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-app-surface border border-app-border shadow-subtle"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ClipboardList className="w-4 h-4 text-app-accent flex-shrink-0" />
                  <div>
                    <span className="text-xs font-mono text-app-text-dim uppercase tracking-wider">Assignment</span>
                    <h3 className="text-sm font-medium text-app-text truncate">{asg.title}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRestore('assignment', asg.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-app-surface-hover hover:bg-app-accent hover:text-white border border-app-border text-xs text-app-text transition-colors"
                    title="Restore assignment"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePermanentDelete('assignment', asg.id, asg.title)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Delete permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {deletedNotebooks.map((nb) => (
              <div
                key={nb.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-app-surface border border-app-border shadow-subtle"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen className="w-4 h-4 text-app-accent flex-shrink-0" />
                  <div>
                    <span className="text-xs font-mono text-app-text-dim uppercase tracking-wider">Notebook</span>
                    <h3 className="text-sm font-medium text-app-text truncate">{nb.title}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRestore('notebook', nb.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-app-surface-hover hover:bg-app-accent hover:text-white border border-app-border text-xs text-app-text transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete('notebook', nb.id, nb.title)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {deletedTextbooks.map((tb) => (
              <div
                key={tb.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-app-surface border border-app-border shadow-subtle"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <GraduationCap className="w-4 h-4 text-app-accent flex-shrink-0" />
                  <div>
                    <span className="text-xs font-mono text-app-text-dim uppercase tracking-wider">Textbook</span>
                    <h3 className="text-sm font-medium text-app-text truncate">{tb.title}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRestore('textbook', tb.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-app-surface-hover hover:bg-app-accent hover:text-white border border-app-border text-xs text-app-text transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete('textbook', tb.id, tb.title)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {deletedSubjects.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-app-surface border border-app-border shadow-subtle"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Tag className="w-4 h-4 text-app-accent flex-shrink-0" />
                  <div>
                    <span className="text-xs font-mono text-app-text-dim uppercase tracking-wider">Subject</span>
                    <h3 className="text-sm font-medium text-app-text truncate">{sub.name}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRestore('subject', sub.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-app-surface-hover hover:bg-app-accent hover:text-white border border-app-border text-xs text-app-text transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete('subject', sub.id, sub.name)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {deletedFolders.map((fld) => (
              <div
                key={fld.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-app-surface border border-app-border shadow-subtle"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FolderIcon className="w-4 h-4 text-app-accent flex-shrink-0" />
                  <div>
                    <span className="text-xs font-mono text-app-text-dim uppercase tracking-wider">Folder</span>
                    <h3 className="text-sm font-medium text-app-text truncate">{fld.name}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRestore('folder', fld.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-app-surface-hover hover:bg-app-accent hover:text-white border border-app-border text-xs text-app-text transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete('folder', fld.id, fld.name)}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
