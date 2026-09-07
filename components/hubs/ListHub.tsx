'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DailyTask, TaskList } from '@/types';
import { supabase, getCurrentUserId } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import {
  getLocalDateString,
  formatPlannerDate,
  formatShortPlannerDate,
  getDateRelativeLabel,
  getLocalStarredTaskIds,
  setLocalTaskStarred,
} from '@/lib/utils/dateUtils';
import {
  Plus,
  Check,
  Clock3,
  Trash2,
  ChevronRight,
  X,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraftTask {
  id: string;
  title: string;
  planned_time: string;
  notes: string;
  is_starred?: boolean;
}

export const ListHub: React.FC = () => {
  // Current local calendar date (real local date, never UTC-shifted)
  const [todayDateStr, setTodayDateStr] = useState<string>(() => getLocalDateString(new Date()));
  
  // Selected date / list in the main view (defaults to today's date)
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString(new Date()));

  // Data from Supabase
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string>(() => getLocalDateString(new Date()));
  const [createTitle, setCreateTitle] = useState('');
  const [draftTasks, setDraftTasks] = useState<DraftTask[]>([
    { id: '1', title: '', planned_time: '', notes: '' },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Inline Task Adder in Main Panel
  const [isAddingInlineTask, setIsAddingInlineTask] = useState(false);
  const [inlineTaskTitle, setInlineTaskTitle] = useState('');
  const [inlineTaskTime, setInlineTaskTime] = useState('');
  const [inlineTaskNotes, setInlineTaskNotes] = useState('');

  // 8:00 A.M. and Window Focus / Resume Refresh
  useEffect(() => {
    const refreshCurrentDate = () => {
      const actualToday = getLocalDateString(new Date());
      setTodayDateStr((prev) => {
        if (prev !== actualToday) {
          return actualToday;
        }
        return prev;
      });
    };

    const interval = setInterval(refreshCurrentDate, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCurrentDate();
        fetchData();
      }
    };
    const handleFocus = () => {
      refreshCurrentDate();
      fetchData();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Fetch lists and tasks from Supabase
  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch Task Lists
      const { data: listsData, error: listsError } = await supabase
        .from('task_lists')
        .select('*')
        .eq('is_deleted', false)
        .order('list_date', { ascending: true });

      if (listsError) throw listsError;
      if (listsData) setTaskLists(listsData);

      // 2. Fetch All Tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('is_deleted', false)
        .order('task_date', { ascending: true })
        .order('planned_time', { ascending: true });

      if (tasksError) throw tasksError;
      if (tasksData) {
        const localStarred = getLocalStarredTaskIds();
        const merged = tasksData.map((t) => ({
          ...t,
          is_starred:
            t.is_starred !== undefined && t.is_starred !== null
              ? Boolean(t.is_starred)
              : localStarred.has(t.id),
        }));
        setTasks(merged);
      }
    } catch (err: any) {
      console.error('Error loading planner data from Supabase:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Draft Task Management in Modal
  const handleDraftTaskChange = (id: string, field: keyof DraftTask, value: any) => {
    setDraftTasks((prev) =>
      prev.map((dt) => (dt.id === id ? { ...dt, [field]: value } : dt))
    );
  };

  const handleAddDraftTaskRow = () => {
    setDraftTasks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: '', planned_time: '', notes: '' },
    ]);
  };

  const handleRemoveDraftTaskRow = (id: string) => {
    if (draftTasks.length <= 1) {
      setDraftTasks([{ id: crypto.randomUUID(), title: '', planned_time: '', notes: '' }]);
      return;
    }
    setDraftTasks((prev) => prev.filter((dt) => dt.id !== id));
  };

  // Open Create List Modal
  const openCreateModalForDate = (dateStr: string = todayDateStr) => {
    setCreateDate(dateStr);
    setCreateTitle('');
    setDraftTasks([{ id: crypto.randomUUID(), title: '', planned_time: '', notes: '' }]);
    setModalError(null);
    setIsCreateModalOpen(true);
  };

  // Save New Dated List with Multiple Tasks in Supabase
  const handleSaveDatedList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createDate) {
      setModalError('Please choose a date.');
      return;
    }

    const validDraftTasks = draftTasks.filter((t) => t.title.trim().length > 0);
    setIsSaving(true);
    setModalError(null);

    try {
      const userId = await getCurrentUserId();

      const listTitle = createTitle.trim() || undefined;
      const listId = crypto.randomUUID();

      // 1. Create the TaskList record in Supabase
      const { data: listData, error: listError } = await supabase
        .from('task_lists')
        .insert([
          {
            id: listId,
            user_id: userId,
            list_date: createDate,
            title: listTitle,
            is_deleted: false,
          },
        ])
        .select()
        .single();

      if (listError) throw listError;

      // 2. Create the associated tasks
      if (validDraftTasks.length > 0) {
        const tasksToInsert = validDraftTasks.map((t) => ({
          user_id: userId,
          list_id: listData?.id || listId,
          title: t.title.trim(),
          task_date: createDate,
          planned_time: t.planned_time.trim() || null,
          notes: t.notes.trim() || null,
          is_starred: Boolean(t.is_starred),
          is_completed: false,
          is_deleted: false,
        }));

        const { error: tasksError } = await supabase
          .from('daily_tasks')
          .insert(tasksToInsert);

        if (tasksError) throw tasksError;
      }

      // Success: Switch main view to the newly created date and close modal
      setSelectedDate(createDate);
      setIsCreateModalOpen(false);
      setIsSaving(false);
      await fetchData();
    } catch (err: any) {
      console.error('Failed to save dated list in Supabase:', err);
      setModalError(err?.message || 'Failed to save dated list to database.');
      setIsSaving(false);
    }
  };

  // Inline Task Add
  const handleAddInlineTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = inlineTaskTitle.trim();
    if (!title) return;

    try {
      const userId = await getCurrentUserId();

      const currentList = taskLists.find((l) => l.list_date === selectedDate);
      const { data, error } = await supabase
        .from('daily_tasks')
        .insert([
          {
            user_id: userId,
            list_id: currentList?.id || null,
            title,
            task_date: selectedDate,
            planned_time: inlineTaskTime.trim() || null,
            notes: inlineTaskNotes.trim() || null,
            is_starred: false,
            is_completed: false,
            is_deleted: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setTasks((prev) => [...prev, data]);
        setInlineTaskTitle('');
        setInlineTaskTime('');
        setInlineTaskNotes('');
        setIsAddingInlineTask(false);
      }
    } catch (err) {
      console.error('Failed to add inline task:', err);
      fetchData();
    }
  };

  // Toggle Task Star (Pins task to top of list)
  const handleToggleStarTask = async (task: DailyTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStarred = !task.is_starred;
    
    // 1. Immediately update UI state
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, is_starred: nextStarred } : t))
    );

    // 2. Immediately persist to localStorage
    setLocalTaskStarred(task.id, nextStarred);

    // 3. Save to Supabase
    try {
      await supabase
        .from('daily_tasks')
        .update({ is_starred: nextStarred, updated_at: new Date().toISOString() })
        .eq('id', task.id);
    } catch (err) {
      console.warn('Supabase task star sync notice:', err);
    }
  };

  // Toggle Task Completion
  const handleToggleTask = async (task: DailyTask) => {
    const nextCompleted = !task.is_completed;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, is_completed: nextCompleted } : t))
    );

    try {
      const { error } = await supabase
        .from('daily_tasks')
        .update({ is_completed: nextCompleted })
        .eq('id', task.id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update task completion in Supabase:', err);
      fetchData();
    }
  };

  // Soft Delete Task
  const handleDeleteTask = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTasks((prev) => prev.filter((t) => t.id !== id));

    try {
      const { error } = await supabase
        .from('daily_tasks')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete task in Supabase:', err);
      fetchData();
    }
  };

  // Soft Delete Entire Dated List
  const handleDeleteDatedList = async (listDate: string, listId?: string) => {
    if (!confirm(`Move list for ${formatShortPlannerDate(listDate)} to Recycle Bin?`)) return;

    try {
      if (listId) {
        await supabase.from('task_lists').update({ is_deleted: true }).eq('id', listId);
      }
      await supabase.from('daily_tasks').update({ is_deleted: true }).eq('task_date', listDate);

      setTaskLists((prev) => prev.filter((l) => l.list_date !== listDate));
      setTasks((prev) => prev.filter((t) => t.task_date !== listDate));
      setSelectedDate(todayDateStr);
    } catch (err) {
      console.error('Failed to delete dated list:', err);
      fetchData();
    }
  };

  // Unique list dates with either a TaskList record or tasks created
  const allDatedEntries = useMemo(() => {
    const datesSet = new Set<string>();
    taskLists.forEach((l) => {
      if (l.list_date) datesSet.add(l.list_date);
    });
    tasks.forEach((t) => {
      if (t.task_date) datesSet.add(t.task_date);
    });
    return Array.from(datesSet).sort();
  }, [taskLists, tasks]);

  // Tasks for Currently Selected Date (Starred tasks pinned to top)
  const selectedDateTasks = useMemo(() => {
    const dateTasks = tasks.filter((t) => t.task_date === selectedDate);
    return dateTasks.sort((a, b) => {
      // 1. Incomplete before completed
      if (a.is_completed !== b.is_completed) {
        return a.is_completed ? 1 : -1;
      }
      // 2. Starred tasks appear at top of list
      if (Boolean(a.is_starred) !== Boolean(b.is_starred)) {
        return a.is_starred ? -1 : 1;
      }
      // 3. Planned time / creation
      const timeA = a.planned_time || '99:99';
      const timeB = b.planned_time || '99:99';
      if (timeA !== timeB) return timeA.localeCompare(timeB);
      return (a.created_at || '').localeCompare(b.created_at || '');
    });
  }, [tasks, selectedDate]);

  // TaskList info for Selected Date (if custom title given)
  const selectedDateListInfo = useMemo(() => {
    return taskLists.find((l) => l.list_date === selectedDate);
  }, [taskLists, selectedDate]);

  // Future / Upcoming Dated Lists (Strictly after Today)
  const upcomingDates = useMemo(() => {
    return allDatedEntries.filter((d) => d > todayDateStr);
  }, [allDatedEntries, todayDateStr]);

  const isSelectedDateToday = selectedDate === todayDateStr;
  const formattedSelectedDate = formatShortPlannerDate(selectedDate);

  return (
    <div className="min-h-full flex flex-col bg-app-bg text-app-text theme-transition">
      {/* Top Header with single compact "Create list" action */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-app-border">
        <h1 className="font-serif text-lg md:text-xl font-medium tracking-tight text-app-text">
          List
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => openCreateModalForDate()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-app-surface hover:bg-app-surface-hover border border-app-border text-xs font-medium text-app-text transition-colors shadow-subtle"
          >
            <Plus className="w-3.5 h-3.5 text-app-accent" />
            <span>Create list</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main 3-Column Structured Layout */}
      <div className="flex-1 p-6 md:px-12 py-8 max-w-6xl w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Compact Chronological List Navigator */}
          <div className="lg:col-span-3 space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-app-accent font-medium">
              Planner Dates
            </span>

            <div className="space-y-1">
              {/* Today Navigation Item */}
              <button
                type="button"
                onClick={() => setSelectedDate(todayDateStr)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all text-left',
                  isSelectedDateToday
                    ? 'bg-app-surface text-app-text font-medium border border-app-accent/60 shadow-subtle'
                    : 'text-app-text-muted hover:bg-app-surface/60 hover:text-app-text border border-transparent'
                )}
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-app-text">Today</span>
                  <span className="text-[11px] text-app-text-dim truncate">
                    {formatShortPlannerDate(todayDateStr)}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-app-accent font-medium">
                  {tasks.filter((t) => t.task_date === todayDateStr).length}
                </span>
              </button>

              {/* Future Dated Lists in strict chronological order */}
              {upcomingDates.map((dateStr) => {
                const count = tasks.filter((t) => t.task_date === dateStr).length;
                const isSelected = selectedDate === dateStr;
                const listInfo = taskLists.find((l) => l.list_date === dateStr);

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setSelectedDate(dateStr)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left',
                      isSelected
                        ? 'bg-app-surface text-app-text font-medium border border-app-accent/60 shadow-subtle'
                        : 'text-app-text-muted hover:bg-app-surface/60 hover:text-app-text border border-transparent'
                    )}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium text-app-text">
                        {listInfo?.title || formatPlannerDate(dateStr, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-[10px] text-app-text-dim">
                        {formatPlannerDate(dateStr, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-app-text-dim">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CENTER: Main, Largest Section (Active/Selected Day List) */}
          <div className="lg:col-span-6 rounded-2xl bg-app-surface border border-app-border p-6 md:p-7 shadow-subtle space-y-6">
            {/* Header for the Selected Date */}
            <div className="flex items-start justify-between border-b border-app-border pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-app-accent font-medium">
                    {getDateRelativeLabel(selectedDate, todayDateStr)}
                  </span>
                  {selectedDateListInfo?.title && (
                    <>
                      <span className="text-app-text-dim">•</span>
                      <span className="text-xs font-medium text-app-text">
                        {selectedDateListInfo.title}
                      </span>
                    </>
                  )}
                </div>
                <h2 className="font-serif text-lg md:text-xl font-medium text-app-text">
                  {formattedSelectedDate}
                </h2>
              </div>

              {selectedDateTasks.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-app-text-muted">
                    {selectedDateTasks.filter((t) => t.is_completed).length} / {selectedDateTasks.length} done
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteDatedList(selectedDate, selectedDateListInfo?.id)}
                    className="p-1 text-app-text-dim hover:text-rose-500 transition-colors"
                    title="Move list to Recycle Bin"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Task List / Empty State */}
            <div className="space-y-2.5 min-h-[220px]">
              {selectedDateTasks.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <p className="text-xs text-app-text-dim font-serif italic">
                    {isSelectedDateToday
                      ? 'No list scheduled for today.'
                      : `No tasks scheduled for ${formattedSelectedDate}.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => openCreateModalForDate(selectedDate)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-app-accent text-white text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSelectedDateToday ? 'Create today’s list' : 'Create list for this date'}</span>
                  </button>
                </div>
              ) : (
                selectedDateTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task)}
                    className={cn(
                      'group p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 text-xs',
                      task.is_completed
                        ? 'bg-app-bg/40 border-transparent text-app-text-dim line-through opacity-70'
                        : cn(
                            'bg-app-bg border-app-border hover:border-app-border-strong text-app-text shadow-subtle',
                            task.is_starred && 'border-amber-500/30 bg-amber-500/[0.03]'
                          )
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
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
                        <span className="break-words leading-relaxed font-normal">
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleToggleStarTask(task, e)}
                          className={cn(
                            'p-1 rounded-md transition-all cursor-pointer',
                            task.is_starred
                              ? 'text-amber-400 hover:text-amber-500 opacity-100'
                              : 'text-app-text-dim hover:text-amber-400 opacity-0 group-hover:opacity-100'
                          )}
                          title={task.is_starred ? 'Starred (pinned to top)' : 'Star task (pin to top)'}
                        >
                          <Star className={cn('w-3.5 h-3.5', task.is_starred && 'fill-current')} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteTask(task.id, e)}
                          className="text-app-text-dim hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer"
                          title="Delete task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {(task.planned_time || task.notes) && (
                      <div className="pl-6 space-y-0.5 text-[11px]">
                        {task.planned_time && (
                          <div className="flex items-center gap-1 text-app-accent font-mono">
                            <Clock3 className="w-3 h-3" />
                            <span>{task.planned_time}</span>
                          </div>
                        )}
                        {task.notes && (
                          <p className="text-app-text-dim leading-relaxed">{task.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Quick Inline Task Adder */}
            <div className="pt-3 border-t border-app-border">
              {isAddingInlineTask ? (
                <form onSubmit={handleAddInlineTask} className="space-y-3">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={inlineTaskTitle}
                    onChange={(e) => setInlineTaskTitle(e.target.value)}
                    placeholder="New task title..."
                    className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-1.5 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      value={inlineTaskTime}
                      onChange={(e) => setInlineTaskTime(e.target.value)}
                      className="bg-app-bg border border-app-border rounded-lg px-2.5 py-1 text-xs text-app-text outline-none focus:border-app-accent transition-colors"
                    />
                    <input
                      type="text"
                      value={inlineTaskNotes}
                      onChange={(e) => setInlineTaskNotes(e.target.value)}
                      placeholder="Note (optional)"
                      className="bg-app-bg border border-app-border rounded-lg px-2.5 py-1 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingInlineTask(false);
                        setInlineTaskTitle('');
                        setInlineTaskTime('');
                        setInlineTaskNotes('');
                      }}
                      className="px-2.5 py-1 text-xs text-app-text-muted hover:text-app-text"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-app-accent text-white rounded-md text-xs font-medium hover:opacity-90"
                    >
                      Add
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingInlineTask(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-app-text-muted hover:text-app-text transition-colors py-1"
                >
                  <Plus className="w-3.5 h-3.5 text-app-accent" />
                  <span>Add task to this list</span>
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: Clean Upcoming Lists Panel */}
          <div className="lg:col-span-3 rounded-2xl bg-app-surface border border-app-border p-5 shadow-subtle space-y-4">
            <div className="border-b border-app-border pb-3">
              <span className="text-[11px] font-mono uppercase tracking-widest text-app-accent font-medium">
                Upcoming Lists
              </span>
            </div>

            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {upcomingDates.length === 0 ? (
                <div className="py-12 text-center text-xs text-app-text-dim font-serif italic">
                  No upcoming lists created.
                </div>
              ) : (
                upcomingDates.map((dateStr) => {
                  const dateTasks = tasks.filter((t) => t.task_date === dateStr);
                  const isSelected = selectedDate === dateStr;
                  const listInfo = taskLists.find((l) => l.list_date === dateStr);

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={cn(
                        'group p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 text-xs',
                        isSelected
                          ? 'bg-app-bg border-app-accent/60 shadow-subtle'
                          : 'bg-app-bg/50 border-app-border hover:border-app-border-strong hover:bg-app-bg'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-medium text-app-text truncate">
                          {formatPlannerDate(dateStr, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-[10px] font-mono text-app-accent">
                          {dateTasks.length} tasks
                        </span>
                      </div>

                      {listInfo?.title && (
                        <p className="text-[11px] text-app-text-muted truncate">
                          {listInfo.title}
                        </p>
                      )}

                      <div className="pt-1 flex items-center justify-end text-[10px] text-app-text-dim group-hover:text-app-accent transition-colors">
                        <span className="flex items-center gap-0.5">
                          View <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CREATE LIST MODAL (Required Date + Multiple Tasks) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-app-surface border border-app-border rounded-2xl shadow-elevated overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
              <h3 className="font-serif text-base font-medium text-app-text">
                Create Dated List
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-md text-app-text-muted hover:text-app-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveDatedList} className="p-6 overflow-y-auto space-y-5 flex-1">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium">
                  {modalError}
                </div>
              )}

              {/* Required Date Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-app-text">
                  Schedule Date <span className="text-app-accent">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text outline-none focus:border-app-accent transition-colors"
                />
                <p className="text-[11px] text-app-text-dim">
                  {formatPlannerDate(createDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {/* Optional List Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-app-text-muted">
                  List Title (optional)
                </label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Marketing Presentation Sprint, Exam Prep..."
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors"
                />
              </div>

              {/* Multiple Tasks Draft Section */}
              <div className="space-y-3 pt-2 border-t border-app-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-app-text">
                    Tasks for this list
                  </label>
                  <button
                    type="button"
                    onClick={handleAddDraftTaskRow}
                    className="text-xs text-app-accent hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add another task</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {draftTasks.map((dt, index) => (
                    <div
                      key={dt.id}
                      className={cn(
                        'p-3 rounded-xl bg-app-bg border border-app-border space-y-2 transition-colors',
                        dt.is_starred && 'border-amber-500/40 bg-amber-500/[0.04]'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-app-text-dim w-4">
                          {index + 1}.
                        </span>
                        <input
                          type="text"
                          required
                          value={dt.title}
                          onChange={(e) => handleDraftTaskChange(dt.id, 'title', e.target.value)}
                          placeholder={`Task ${index + 1} title...`}
                          className="flex-1 bg-transparent border-0 text-xs text-app-text placeholder-app-text-dim outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleDraftTaskChange(dt.id, 'is_starred', !dt.is_starred)}
                          className={cn(
                            'p-1 rounded-md transition-colors cursor-pointer',
                            dt.is_starred
                              ? 'text-amber-400 hover:text-amber-500'
                              : 'text-app-text-dim hover:text-amber-400'
                          )}
                          title={dt.is_starred ? 'Starred (will appear at top)' : 'Star this task (pin to top)'}
                        >
                          <Star className={cn('w-3.5 h-3.5', dt.is_starred && 'fill-current')} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftTaskRow(dt.id)}
                          className="text-app-text-dim hover:text-rose-500 p-0.5 cursor-pointer"
                          title="Remove task"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pl-6">
                        <input
                          type="time"
                          value={dt.planned_time}
                          onChange={(e) => handleDraftTaskChange(dt.id, 'planned_time', e.target.value)}
                          className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1 text-[11px] text-app-text outline-none focus:border-app-accent"
                          placeholder="Time"
                        />
                        <input
                          type="text"
                          value={dt.notes}
                          onChange={(e) => handleDraftTaskChange(dt.id, 'notes', e.target.value)}
                          placeholder="Note (optional)"
                          className="bg-app-surface border border-app-border rounded-lg px-2.5 py-1 text-[11px] text-app-text placeholder-app-text-dim outline-none focus:border-app-accent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-app-border flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs text-app-text-muted hover:text-app-text transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-app-accent hover:opacity-90 disabled:opacity-50 text-white text-xs font-medium transition-opacity shadow-subtle"
                >
                  {isSaving ? 'Creating in Supabase...' : 'Create list'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
