'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Assignment, Subject } from '@/types';
import { supabase, getCurrentUserId } from '@/lib/supabase/client';
import { getLocalDateString, formatPlannerDate } from '@/lib/utils/dateUtils';
import {
  Plus,
  Calendar,
  Clock,
  BookOpen,
  Check,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeadlineInfo {
  diffDays: number;
  formattedDate: string;
  displayStatus: string;
  textColorClass: string;
  badgeClass: string;
}

function getDeadlineInfo(dueDateStr: string, todayDateStr: string): DeadlineInfo {
  if (!dueDateStr) {
    return {
      diffDays: 999,
      formattedDate: '',
      displayStatus: '',
      textColorClass: 'text-app-text',
      badgeClass: 'bg-app-surface text-app-text-muted border-app-border',
    };
  }

  const parts = dueDateStr.split('-');
  const y1 = parseInt(parts[0], 10);
  const m1 = parseInt(parts[1], 10);
  const d1 = parseInt(parts[2], 10);

  const todayParts = todayDateStr.split('-');
  const y2 = parseInt(todayParts[0], 10);
  const m2 = parseInt(todayParts[1], 10);
  const d2 = parseInt(todayParts[2], 10);

  const due = new Date(y1, m1 - 1, d1);
  const today = new Date(y2, m2 - 1, d2);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${monthNames[m1 - 1] || ''} ${d1}`;

  if (diffDays < 0) {
    return {
      diffDays,
      formattedDate,
      displayStatus: `Overdue (Due ${formattedDate})`,
      textColorClass: 'text-rose-500 font-medium',
      badgeClass: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
    };
  }
  if (diffDays === 0) {
    return {
      diffDays,
      formattedDate,
      displayStatus: 'Due today',
      textColorClass: 'text-rose-500 font-medium',
      badgeClass: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
    };
  }
  if (diffDays === 1) {
    return {
      diffDays,
      formattedDate,
      displayStatus: `Due tomorrow (${formattedDate})`,
      textColorClass: 'text-rose-500 font-medium',
      badgeClass: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
    };
  }
  if (diffDays === 2) {
    return {
      diffDays,
      formattedDate,
      displayStatus: `Due in 2 days (${formattedDate})`,
      textColorClass: 'text-amber-400 font-medium',
      badgeClass: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
    };
  }
  return {
    diffDays,
    formattedDate,
    displayStatus: `Due ${formattedDate}`,
    textColorClass: 'text-app-text font-normal',
    badgeClass: 'bg-app-surface text-app-text-muted border-app-border',
  };
}

export const AssignmentsHub: React.FC = () => {
  const dateKey = getLocalDateString(new Date());

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDueDate, setFormDueDate] = useState(dateKey);
  const [formDueTime, setFormDueTime] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Completed section collapsed state
  const [isCompletedOpen, setIsCompletedOpen] = useState(true);

  // Fetch real assignments & subjects from Supabase
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Fetch subjects
      const { data: subData } = await supabase
        .from('subjects')
        .select('*')
        .eq('is_deleted', false)
        .order('name', { ascending: true });

      if (subData) setSubjects(subData);

      // 2. Fetch assignments
      const { data: asgData, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('is_deleted', false)
        .order('due_date', { ascending: true });

      if (error) {
        console.warn('Assignments fetch error:', error.message);
        setAssignments([]);
      } else if (asgData) {
        setAssignments(asgData);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingAssignment(null);
    setFormTitle('');
    setFormDueDate(dateKey);
    setFormDueTime('');
    setFormSubjectId('');
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (asg: Assignment) => {
    setEditingAssignment(asg);
    setFormTitle(asg.title);
    setFormDueDate(asg.due_date || asg.dueDate || dateKey);
    setFormDueTime(asg.due_time || '');
    setFormSubjectId(asg.subject_id || '');
    setFormNotes(asg.notes || asg.description || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save Assignment (Insert or Update)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Assignment title is required.');
      return;
    }
    if (!formDueDate) {
      setFormError('Due date is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const userId = await getCurrentUserId();
      const payload: any = {
        title: formTitle.trim(),
        due_date: formDueDate,
        due_time: formDueTime.trim() || null,
        subject_id: formSubjectId || null,
        notes: formNotes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingAssignment) {
        // Update existing
        const { error } = await supabase
          .from('assignments')
          .update(payload)
          .eq('id', editingAssignment.id);

        if (error) throw error;

        setAssignments((prev) =>
          prev.map((a) => (a.id === editingAssignment.id ? { ...a, ...payload } : a))
        );
      } else {
        // Create new
        payload.user_id = userId;
        payload.is_completed = false;
        payload.is_deleted = false;
        payload.status = 'not_started';

        const { data, error } = await supabase
          .from('assignments')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setAssignments((prev) => [...prev, data]);
        }
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save assignment:', err);
      setFormError(err.message || 'Failed to save assignment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Completion
  const handleToggleComplete = async (asg: Assignment) => {
    const nextCompleted = !asg.is_completed;
    const nextStatus = nextCompleted ? 'completed' : 'not_started';

    setAssignments((prev) =>
      prev.map((a) =>
        a.id === asg.id
          ? { ...a, is_completed: nextCompleted, status: nextStatus }
          : a
      )
    );

    try {
      const { error } = await supabase
        .from('assignments')
        .update({
          is_completed: nextCompleted,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', asg.id);

      if (error) {
        console.error('Failed to toggle completion:', error);
        fetchData();
      }
    } catch (err) {
      console.error('Error toggling complete:', err);
    }
  };

  // Move to Recycle Bin (Soft Delete)
  const handleDeleteAssignment = async (id: string, title: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));

    try {
      const { error } = await supabase
        .from('assignments')
        .update({ is_deleted: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('Failed to delete assignment:', error);
        fetchData();
      }
    } catch (err) {
      console.error('Error deleting assignment:', err);
    }
  };

  // Filter Active vs Completed
  const activeAssignments = assignments
    .filter((a) => !a.is_completed)
    .sort((a, b) => {
      const dateA = (a.due_date || a.dueDate || '') + (a.due_time || '');
      const dateB = (b.due_date || b.dueDate || '') + (b.due_time || '');
      return dateA.localeCompare(dateB);
    });

  const completedAssignments = assignments
    .filter((a) => a.is_completed)
    .sort((a, b) => {
      const dateA = a.due_date || a.dueDate || '';
      const dateB = b.due_date || b.dueDate || '';
      return dateB.localeCompare(dateA);
    });

  const getSubjectName = (subjectId?: string | null) => {
    if (!subjectId) return null;
    return subjects.find((s) => s.id === subjectId)?.name || null;
  };

  return (
    <div className="min-h-full flex flex-col bg-app-bg text-app-text theme-transition">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-app-border">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-lg md:text-xl font-medium tracking-tight text-app-text">
            Assignments
          </h1>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-app-surface border border-app-border text-app-accent font-semibold">
            {activeAssignments.length}
          </span>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-app-accent hover:opacity-90 text-white text-xs font-medium transition-all shadow-subtle cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New assignment</span>
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 px-6 md:px-12 py-8 max-w-5xl w-full mx-auto space-y-8">
        {/* Active Assignments Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-widest text-app-accent font-medium">
              Active Assignments ({activeAssignments.length})
            </h2>
          </div>

          {activeAssignments.length === 0 ? (
            <div className="p-12 rounded-3xl border border-app-border bg-app-surface/50 text-center space-y-3 shadow-subtle">
              <p className="font-serif text-sm text-app-text-dim italic">
                No active assignments.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1 text-xs text-app-accent hover:underline font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create an assignment</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAssignments.map((asg) => {
                const rawDueDate = asg.due_date || asg.dueDate || '';
                const deadline = getDeadlineInfo(rawDueDate, dateKey);
                const subjectName = getSubjectName(asg.subject_id);

                return (
                  <div
                    key={asg.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-app-surface border border-app-border hover:border-app-accent/60 transition-all shadow-subtle"
                  >
                    {/* Left: Checkbox & Title & Subject */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(asg)}
                        className="w-5 h-5 rounded-lg border border-app-border hover:border-app-accent flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors cursor-pointer"
                        title="Mark as completed"
                      >
                        {asg.is_completed && <Check className="w-3.5 h-3.5 text-app-accent stroke-[2.5]" />}
                      </button>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-medium text-app-text break-words">
                            {asg.title}
                          </h3>
                          {subjectName && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-app-bg border border-app-border text-app-accent">
                              {subjectName}
                            </span>
                          )}
                        </div>

                        {asg.notes && (
                          <p className="text-xs text-app-text-muted line-clamp-2 leading-relaxed">
                            {asg.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Due Date & Action Controls */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-app-border/60">
                      {/* Urgency Due Date Display */}
                      <div className="flex items-center gap-1.5">
                        <span className={cn('text-xs font-mono px-2.5 py-1 rounded-lg border', deadline.badgeClass)}>
                          {deadline.displayStatus}
                          {asg.due_time && ` at ${asg.due_time}`}
                        </span>
                      </div>

                      {/* Action Menu */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(asg)}
                          className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors"
                          title="Edit assignment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteAssignment(asg.id, asg.title)}
                          className="p-1.5 rounded-lg text-app-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Move to Recycle Bin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Completed Assignments Section */}
        {completedAssignments.length > 0 && (
          <section className="pt-6 border-t border-app-border space-y-3">
            <button
              type="button"
              onClick={() => setIsCompletedOpen(!isCompletedOpen)}
              className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-app-text-dim hover:text-app-text transition-colors cursor-pointer"
            >
              <span>Completed ({completedAssignments.length})</span>
              {isCompletedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {isCompletedOpen && (
              <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                {completedAssignments.map((asg) => {
                  const subjectName = getSubjectName(asg.subject_id);

                  return (
                    <div
                      key={asg.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-app-surface/60 border border-app-border text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(asg)}
                          className="w-4 h-4 rounded bg-app-accent border border-app-accent flex items-center justify-center flex-shrink-0 text-white cursor-pointer"
                          title="Unmark completed"
                        >
                          <Check className="w-3 h-3 stroke-[2.5]" />
                        </button>

                        <span className="line-through text-app-text-muted truncate">
                          {asg.title}
                        </span>

                        {subjectName && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-app-bg border border-app-border text-app-text-dim">
                            {subjectName}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteAssignment(asg.id, asg.title)}
                        className="p-1 rounded text-app-text-dim hover:text-rose-500 transition-colors"
                        title="Move to Recycle Bin"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Creation / Edit Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-app-surface border border-app-border p-6 sm:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-app-border pb-3.5">
              <h3 className="font-serif text-base font-medium text-app-text">
                {editingAssignment ? 'Edit Assignment' : 'New Assignment'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-app-text-muted hover:text-app-text transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error message */}
            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text">
                  Assignment Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Submit the Business Model Canvas"
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors"
                />
              </div>

              {/* Due Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text">
                    Due Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text outline-none focus:border-app-accent transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text">
                    Due Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={formDueTime}
                    onChange={(e) => setFormDueTime(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text outline-none focus:border-app-accent transition-colors"
                  />
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text">
                  Subject (Optional)
                </label>
                <select
                  value={formSubjectId}
                  onChange={(e) => setFormSubjectId(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text outline-none focus:border-app-accent transition-colors"
                >
                  <option value="">No Subject</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text">
                  Notes / Instructions (Optional)
                </label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Add assignment rubric, submission instructions, or link notes..."
                  className="w-full bg-app-bg border border-app-border rounded-xl p-3 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-app-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs text-app-text-muted hover:text-app-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-app-accent text-white rounded-xl text-xs font-medium hover:opacity-90 transition-opacity shadow-subtle disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingAssignment ? 'Save Changes' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
