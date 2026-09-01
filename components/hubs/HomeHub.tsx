'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Notebook, Textbook, DailyTask, Assignment } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import {
  Plus,
  BookPlus,
  GraduationCap,
  Star,
  Check,
  Trash2,
  ChevronRight,
  LogOut,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getLocalDateString, formatPlannerDate } from '@/lib/utils/dateUtils';

interface HomeHubProps {
  userEmail?: string;
  onOpenCreateModal: (type: 'notebook' | 'textbook') => void;
  onSignOut: () => void;
  onOpenNotebook: (notebook: Notebook) => void;
}

interface DeadlineInfo {
  diffDays: number;
  formattedDate: string;
  displayStatus: string;
  textColorClass: string;
}

function getDeadlineInfo(dueDateStr: string, todayDateStr: string): DeadlineInfo {
  if (!dueDateStr) {
    return {
      diffDays: 999,
      formattedDate: '',
      displayStatus: '',
      textColorClass: 'text-app-text',
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
      displayStatus: `Overdue (${formattedDate})`,
      textColorClass: 'text-rose-500 font-medium',
    };
  }
  if (diffDays === 0) {
    return {
      diffDays,
      formattedDate,
      displayStatus: 'Due today',
      textColorClass: 'text-rose-500 font-medium',
    };
  }
  if (diffDays === 1) {
    return {
      diffDays,
      formattedDate,
      displayStatus: `Due tomorrow (${formattedDate})`,
      textColorClass: 'text-rose-500 font-medium',
    };
  }
  if (diffDays === 2) {
    return {
      diffDays,
      formattedDate,
      displayStatus: `Due in 2 days (${formattedDate})`,
      textColorClass: 'text-amber-400 font-medium',
    };
  }
  return {
    diffDays,
    formattedDate,
    displayStatus: `Due ${formattedDate}`,
    textColorClass: 'text-app-text font-normal',
  };
}

export const HomeHub: React.FC<HomeHubProps> = ({
  userEmail,
  onOpenCreateModal,
  onSignOut,
  onOpenNotebook,
}) => {
  // Current local calendar date
  const dateKey = getLocalDateString(new Date()); // YYYY-MM-DD
  const formattedDate = formatPlannerDate(dateKey);

  // State from Supabase
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [todayTasks, setTodayTasks] = useState<DailyTask[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // + New dropdown menu state
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  const [newTaskInput, setNewTaskInput] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(event.target as Node)) {
        setIsNewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch real data from Supabase for the signed-in user
  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch notebooks
      const { data: nbData } = await supabase
        .from('notebooks')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (nbData) setNotebooks(nbData);

      // 2. Fetch textbooks
      const { data: tbData } = await supabase
        .from('textbooks')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (tbData) setTextbooks(tbData);

      // 3. Fetch today's tasks
      const { data: taskData } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('task_date', dateKey)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (taskData) setTodayTasks(taskData);

      // 4. Fetch assignments if table exists
      try {
        const { data: assignData } = await supabase
          .from('assignments')
          .select('*')
          .eq('is_deleted', false)
          .order('due_date', { ascending: true });

        if (assignData) {
          setAssignments(assignData);
        }
      } catch (e) {
        // Assignments table not yet queried or empty
        setAssignments([]);
      }
    } catch (err) {
      console.error('Error loading Supabase data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dateKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Add Task to Supabase
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTaskInput.trim();
    if (!title) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const tempId = crypto.randomUUID();
      const optimisticTask: DailyTask = {
        id: tempId,
        user_id: user.id,
        title,
        task_date: dateKey,
        is_completed: false,
        is_deleted: false,
        created_at: new Date().toISOString(),
      };
      setTodayTasks((prev) => [...prev, optimisticTask]);
      setNewTaskInput('');
      setIsAddingTask(false);

      const { data, error } = await supabase
        .from('daily_tasks')
        .insert([{ user_id: user.id, title, task_date: dateKey, is_completed: false, is_deleted: false }])
        .select()
        .single();

      if (error) {
        console.error('Failed to add task to Supabase:', error);
        fetchData();
      } else if (data) {
        setTodayTasks((prev) => prev.map((t) => (t.id === tempId ? data : t)));
      }
    } catch (err) {
      console.error('Error in handleAddTask:', err);
    }
  };

  // Toggle Task Completion in Supabase
  const handleToggleTask = async (task: DailyTask) => {
    const nextCompleted = !task.is_completed;

    setTodayTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, is_completed: nextCompleted } : t))
    );

    const { error } = await supabase
      .from('daily_tasks')
      .update({ is_completed: nextCompleted })
      .eq('id', task.id);

    if (error) {
      console.error('Failed to update task in Supabase:', error);
      fetchData();
    }
  };

  // Delete Task (soft delete)
  const handleDeleteTask = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTodayTasks((prev) => prev.filter((t) => t.id !== id));

    const { error } = await supabase
      .from('daily_tasks')
      .update({ is_deleted: true })
      .eq('id', id);

    if (error) {
      console.error('Failed to delete task from Supabase:', error);
      fetchData();
    }
  };

  // Toggle Star on Notebook
  const handleToggleStarNotebook = async (nb: Notebook, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStarred = !nb.is_starred;

    setNotebooks((prev) =>
      prev.map((n) => (n.id === nb.id ? { ...n, is_starred: nextStarred } : n))
    );

    const { error } = await supabase
      .from('notebooks')
      .update({ is_starred: nextStarred, updated_at: new Date().toISOString() })
      .eq('id', nb.id);

    if (error) {
      console.error('Failed to update notebook star in Supabase:', error);
      fetchData();
    }
  };

  // Toggle Star on Textbook
  const handleToggleStarTextbook = async (tb: Textbook, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStarred = !tb.is_starred;

    setTextbooks((prev) =>
      prev.map((t) => (t.id === tb.id ? { ...t, is_starred: nextStarred } : t))
    );

    const { error } = await supabase
      .from('textbooks')
      .update({ is_starred: nextStarred, updated_at: new Date().toISOString() })
      .eq('id', tb.id);

    if (error) {
      console.error('Failed to update textbook star in Supabase:', error);
      fetchData();
    }
  };

  // Filtered Starred items
  const starredNotebooks = notebooks.filter((n) => n.is_starred);
  const starredTextbooks = textbooks.filter((t) => t.is_starred);
  const hasStarred = starredNotebooks.length > 0 || starredTextbooks.length > 0;

  // Sorted upcoming active assignments (sorted by nearest deadline first)
  const sortedAssignments = [...assignments]
    .filter((a) => !a.is_completed && !a.is_deleted && !a.isDeleted)
    .sort((a, b) => {
      const dateA = a.due_date || a.dueDate || '';
      const dateB = b.due_date || b.dueDate || '';
      return dateA.localeCompare(dateB);
    });

  return (
    <div className="min-h-full flex flex-col bg-app-bg text-app-text theme-transition">
      {/* Top Header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-app-border">
        <h1 className="font-serif text-lg md:text-xl font-medium tracking-tight text-app-text">
          Home
        </h1>
        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="text-[11px] font-mono text-app-text-muted hidden sm:inline truncate max-w-[180px]">
              {userEmail}
            </span>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors border border-app-border cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 px-6 md:px-12 py-8 max-w-6xl w-full mx-auto space-y-10">
        {/* Single Compact "+ New" Action Button */}
        <div className="relative inline-block" ref={newMenuRef}>
          <button
            type="button"
            onClick={() => setIsNewMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-app-surface hover:bg-app-surface-hover border border-app-border text-xs font-medium text-app-text transition-colors shadow-subtle cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-app-accent" />
            <span>New</span>
          </button>

          {isNewMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-44 rounded-xl bg-app-surface border border-app-border shadow-elevated py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setIsNewMenuOpen(false);
                  onOpenCreateModal('notebook');
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-app-text hover:bg-app-surface-hover transition-colors text-left cursor-pointer"
              >
                <BookPlus className="w-3.5 h-3.5 text-app-accent" />
                <span>New notebook</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNewMenuOpen(false);
                  onOpenCreateModal('textbook');
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-app-text hover:bg-app-surface-hover transition-colors text-left cursor-pointer"
              >
                <GraduationCap className="w-3.5 h-3.5 text-app-accent" />
                <span>New textbook</span>
              </button>
            </div>
          )}
        </div>

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 1. Large Left / Main Position: Today List Panel */}
          <div className="lg:col-span-8 flex flex-col rounded-3xl bg-app-surface border border-app-border p-6 sm:p-8 shadow-subtle space-y-6">
            {/* Today Header */}
            <div className="flex items-center justify-between border-b border-app-border pb-4">
              <div className="space-y-0.5">
                <span className="text-[11px] font-mono uppercase tracking-widest text-app-accent font-medium">
                  Today
                </span>
                <h2 className="text-base sm:text-lg font-medium text-app-text font-serif">
                  {formattedDate}
                </h2>
              </div>
              <span className="text-xs font-mono text-app-text-muted bg-app-bg px-2.5 py-1 rounded-lg border border-app-border">
                {todayTasks.filter((t) => !t.is_completed).length} remaining
              </span>
            </div>

            {/* Task List / Empty State */}
            <div className="space-y-2 overflow-y-auto max-h-80 pr-1">
              {todayTasks.length === 0 ? (
                <div className="py-12 text-center text-xs text-app-text-dim font-serif italic">
                  Nothing planned for today.
                </div>
              ) : (
                todayTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task)}
                    className={cn(
                      'group flex items-start justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer text-xs',
                      task.is_completed
                        ? 'bg-app-bg/50 border-transparent text-app-text-dim line-through'
                        : 'bg-app-surface border-app-border text-app-text hover:border-app-accent/60'
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                          task.is_completed
                            ? 'bg-app-accent border-app-accent text-white'
                            : 'border-app-border group-hover:border-app-accent'
                        )}
                      >
                        {task.is_completed && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </div>
                      <span className="break-words leading-relaxed">{task.title}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteTask(task.id, e)}
                      className="text-app-text-dim hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                      title="Remove task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Task Input */}
            <div className="pt-3 border-t border-app-border">
              {isAddingTask ? (
                <form onSubmit={handleAddTask} className="space-y-2">
                  <input
                    type="text"
                    autoFocus
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    placeholder="Task for today..."
                    className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingTask(false);
                        setNewTaskInput('');
                      }}
                      className="px-3 py-1.5 text-xs text-app-text-muted hover:text-app-text transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-app-accent text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity shadow-subtle"
                    >
                      Add
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingTask(true)}
                  className="flex items-center gap-1.5 text-xs text-app-text-muted hover:text-app-text transition-colors py-1 cursor-pointer font-medium"
                >
                  <Plus className="w-3.5 h-3.5 text-app-accent" />
                  <span>Add a task</span>
                </button>
              )}
            </div>
          </div>

          {/* 2. Narrower Right-Side Panel: Assignment Deadlines */}
          <div className="lg:col-span-4 flex flex-col rounded-3xl bg-app-surface border border-app-border p-6 shadow-subtle space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-app-border pb-3.5">
              <div className="space-y-0.5">
                <span className="text-[11px] font-mono uppercase tracking-widest text-app-accent font-medium">
                  Deadlines
                </span>
                <h3 className="text-sm font-medium text-app-text font-serif">
                  Assignment deadlines
                </h3>
              </div>
            </div>

            {/* Assignments List / Empty State */}
            <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1">
              {sortedAssignments.length === 0 ? (
                <div className="py-12 text-center text-xs text-app-text-dim font-serif italic">
                  No upcoming assignment deadlines.
                </div>
              ) : (
                sortedAssignments.map((assignment) => {
                  const rawDueDate = assignment.due_date || assignment.dueDate || '';
                  const info = getDeadlineInfo(rawDueDate, dateKey);

                  return (
                    <div
                      key={assignment.id}
                      className="p-3 rounded-xl border border-app-border bg-app-bg/60 space-y-1.5 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium text-app-text line-clamp-1">
                          {assignment.title}
                        </span>
                        {assignment.course && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-app-surface border border-app-border text-app-text-muted">
                            {assignment.course}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className={info.textColorClass}>
                          {info.displayStatus}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Section: Starred */}
        <section className="pt-6 border-t border-app-border space-y-4">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-app-accent fill-app-accent/20" />
            <h2 className="font-serif text-base font-medium text-app-text">
              Starred
            </h2>
          </div>

          {!hasStarred ? (
            <div className="p-8 rounded-2xl border border-app-border bg-app-surface/40 text-center text-xs text-app-text-dim font-serif italic">
              No starred notes yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {starredNotebooks.map((nb) => (
                <div
                  key={nb.id}
                  className="group p-4 rounded-2xl bg-app-surface border border-app-border hover:border-app-accent/60 transition-all space-y-2 shadow-subtle flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-app-accent">
                        Notebook
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleToggleStarNotebook(nb, e)}
                        className="text-app-accent hover:opacity-80 p-0.5"
                        title="Unstar notebook"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                    <h3 className="text-sm font-medium text-app-text line-clamp-1">
                      {nb.title}
                    </h3>
                  </div>

                  <div className="pt-2 border-t border-app-border flex items-center justify-end text-[11px] text-app-text-muted">
                    <button
                      type="button"
                      onClick={() => onOpenNotebook(nb)}
                      className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform hover:text-app-text cursor-pointer"
                    >
                      Open <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {starredTextbooks.map((tb) => (
                <div
                  key={tb.id}
                  className="group p-4 rounded-2xl bg-app-surface border border-app-border hover:border-app-accent/60 transition-all space-y-2 shadow-subtle flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-app-accent">
                        Textbook
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleToggleStarTextbook(tb, e)}
                        className="text-app-accent hover:opacity-80 p-0.5"
                        title="Unstar textbook"
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                    <h3 className="text-sm font-medium text-app-text line-clamp-1">
                      {tb.title}
                    </h3>
                  </div>

                  <div className="pt-2 border-t border-app-border flex items-center justify-end text-[11px] text-app-text-muted">
                    <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Read <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
