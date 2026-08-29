'use client';

import React, { useState } from 'react';
import { Homework, Notebook } from '@/types';
import {
  BookMarked,
  Plus,
  Clock,
  CheckCircle2,
  FileText,
  BookOpen,
} from 'lucide-react';
import { dbUpdateHomework } from '@/lib/db/dexie';
import { formatDueDate, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface HomeworksHubProps {
  homeworks: Homework[];
  notebooks: Notebook[];
  onOpenNotebook: (notebook: Notebook) => void;
  onRefresh: () => void;
  onOpenCreateModal: (type?: string) => void;
  searchQuery: string;
}

export const HomeworksHub: React.FC<HomeworksHubProps> = ({
  homeworks,
  notebooks,
  onOpenNotebook,
  onRefresh,
  onOpenCreateModal,
  searchQuery,
}) => {
  const [filter, setFilter] = useState<string>('all');

  const filtered = homeworks.filter((hw) => {
    if (filter === 'pending' && (hw.status === 'completed' || hw.status === 'submitted')) return false;
    if (filter === 'completed' && hw.status !== 'completed' && hw.status !== 'submitted') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        hw.title.toLowerCase().includes(q) ||
        hw.course.toLowerCase().includes(q) ||
        hw.instructions?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleStatusChange = async (hw: Homework, status: any) => {
    await dbUpdateHomework(hw.id, { status });
    onRefresh();
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-white">Homeworks & Problem Sets</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-purple-400 font-semibold">
              {filtered.length}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Track daily homework submissions, lab reports, and exercises
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenCreateModal('homework')}
          className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-glow transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Homework</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {['all', 'pending', 'completed'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all capitalize',
              filter === f
                ? 'bg-brand-500 text-white shadow-glow'
                : 'bg-dark-900 text-slate-400 hover:text-white border border-slate-800'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Homework Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-800 rounded-3xl bg-dark-950/40 space-y-3">
          <BookMarked className="w-10 h-10 text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">No homework found</p>
          <p className="text-xs text-slate-500">Track homework tasks and submission instructions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((hw) => {
            const dueInfo = formatDueDate(hw.dueDate);
            const linkedNb = notebooks.find((n) => n.id === hw.notebookId);

            return (
              <div
                key={hw.id}
                className="p-5 rounded-2xl bg-dark-900/90 border border-slate-800 hover:border-purple-500/50 transition-all space-y-4 shadow-lg flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 font-semibold">
                      {hw.course}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium ${
                        hw.status === 'completed' || hw.status === 'submitted'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {hw.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-white line-clamp-2">{hw.title}</h3>

                  {hw.instructions && (
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {hw.instructions}
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Due</span>
                    </span>
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-medium ${
                        dueInfo.isOverdue
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : dueInfo.isSoon
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {dueInfo.text}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <select
                      value={hw.status}
                      onChange={(e) => handleStatusChange(hw, e.target.value)}
                      className="bg-dark-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 outline-none capitalize focus:border-brand-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="submitted">Submitted</option>
                    </select>

                    {linkedNb && (
                      <button
                        type="button"
                        onClick={() => onOpenNotebook(linkedNb)}
                        className="px-2.5 py-1 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-medium flex items-center gap-1 transition-colors truncate max-w-[140px]"
                      >
                        <BookOpen className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">Notes</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
