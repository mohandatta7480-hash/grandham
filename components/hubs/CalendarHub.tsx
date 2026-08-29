'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarEvent, DailyTask } from '@/types';
import { supabase, getCurrentUserId } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import {
  getLocalDateString,
  formatPlannerDate,
  formatShortPlannerDate,
} from '@/lib/utils/dateUtils';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Trash2,
  Edit2,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  CalendarCheck,
  CheckSquare,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type CalendarViewMode = 'month' | 'week' | 'day';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const CalendarHub: React.FC = () => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => getLocalDateString(new Date()));
  const [todayStr] = useState<string>(() => getLocalDateString(new Date()));

  // Internal data from Supabase
  const [internalEvents, setInternalEvents] = useState<CalendarEvent[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<DailyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Google Calendar Integration State
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<CalendarEvent[]>([]);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

  // Calendar Settings Modal & Google Calendars List
  const [isCalendarSettingsOpen, setIsCalendarSettingsOpen] = useState(false);
  const [availableCalendars, setAvailableCalendars] = useState<Array<{ id: string; summary: string; primary: boolean; selected: boolean }>>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('primary');
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isUpdatingCalendarId, setIsUpdatingCalendarId] = useState(false);

  // Time Block / Event Create & Edit Modal State
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDate, setModalDate] = useState(selectedDateStr);
  const [modalStartTime, setModalStartTime] = useState('09:00');
  const [modalEndTime, setModalEndTime] = useState('10:00');
  const [modalNotes, setModalNotes] = useState('');
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Fetch Google Calendar Events via API
  const fetchGoogleEvents = useCallback(async (userId: string) => {
    try {
      setIsSyncingGoogle(true);
      const res = await fetch(`/api/calendar/events?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        const mapped: CalendarEvent[] = (data.items || []).map((item: any) => {
          const startDate = item.start?.dateTime
            ? item.start.dateTime.slice(0, 10)
            : item.start?.date || '';
          const startTime = item.start?.dateTime
            ? item.start.dateTime.slice(11, 16)
            : null;
          const endTime = item.end?.dateTime
            ? item.end.dateTime.slice(11, 16)
            : null;

          return {
            id: `google_${item.id}`,
            google_event_id: item.id,
            title: item.summary || '(Untitled Google Event)',
            event_date: startDate,
            start_time: startTime,
            end_time: endTime,
            notes: item.description || null,
            source: 'google' as const,
            color: '#3b82f6',
          };
        });
        setGoogleEvents(mapped);
      }
    } catch (e) {
      console.error('Failed to load Google events:', e);
    } finally {
      setIsSyncingGoogle(false);
    }
  }, []);

  // Fetch Available Calendars
  const fetchAvailableCalendars = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/calendar/list?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableCalendars(data.calendars || []);
        if (data.selectedCalendarId) {
          setSelectedCalendarId(data.selectedCalendarId);
        }
      }
    } catch (e) {
      console.error('Failed to load Google calendars list:', e);
    }
  }, []);

  // Fetch Internal Data & Google Status
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const userId = await getCurrentUserId();

      // 1. Fetch Internal Calendar Events
      const { data: eventsData } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('is_deleted', false)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (eventsData) setInternalEvents(eventsData);

      // 2. Fetch Scheduled Tasks from List Planner
      const { data: tasksData } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('is_deleted', false)
        .order('task_date', { ascending: true });

      if (tasksData) setScheduledTasks(tasksData);

      // 3. Check Google Calendar connection status
      const connRes = await fetch(`/api/calendar/connection?userId=${userId}`);
      if (connRes.ok) {
        const connData = await connRes.json();
        const connected = Boolean(connData.connected);
        setGoogleConnected(connected);
        setGoogleEmail(connData.email || null);
        setIsConfigured(Boolean(connData.configured));
        if (connData.calendarId) {
          setSelectedCalendarId(connData.calendarId);
        }

        // If connected, fetch Google events and calendars
        if (connected) {
          fetchGoogleEvents(userId);
          fetchAvailableCalendars(userId);
        }
      }
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchGoogleEvents, fetchAvailableCalendars]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Connect Google Calendar Action
  const handleConnectGoogle = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || (await getCurrentUserId());

    if (!isConfigured) {
      setIsSetupModalOpen(true);
      return;
    }

    // Redirect to OAuth initiation endpoint
    window.location.href = `/api/auth/google-calendar?userId=${userId}`;
  };

  // Disconnect Google Calendar Action
  const handleDisconnectGoogle = async () => {
    if (!confirm('Disconnect Google Calendar sync?')) return;
    const userId = await getCurrentUserId();

    try {
      await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      setGoogleConnected(false);
      setGoogleEmail(null);
      setGoogleEvents([]);
      setAvailableCalendars([]);
      setSyncStatusMsg({ text: 'Google Calendar disconnected.' });
    } catch (e) {
      console.error('Failed to disconnect Google Calendar:', e);
    }
  };

  // Update target Google Calendar
  const handleSelectCalendar = async (newCalId: string) => {
    try {
      setIsUpdatingCalendarId(true);
      setSelectedCalendarId(newCalId);
      const userId = await getCurrentUserId();
      const res = await fetch('/api/calendar/connection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, calendarId: newCalId }),
      });
      if (res.ok) {
        fetchGoogleEvents(userId);
        setSyncStatusMsg({ text: 'Target calendar updated successfully.' });
      }
    } catch (e) {
      console.error('Failed to update calendar selection:', e);
      setSyncStatusMsg({ text: 'Failed to update calendar selection.', isError: true });
    } finally {
      setIsUpdatingCalendarId(false);
    }
  };

  // Manual "Sync now" action
  const handleSyncNow = async () => {
    try {
      setIsSyncingNow(true);
      setSyncStatusMsg(null);
      const userId = await getCurrentUserId();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, timeZone }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.syncedCount > 0) {
          setSyncStatusMsg({
            text: `Successfully synced ${data.syncedCount} event${data.syncedCount === 1 ? '' : 's'} with Google Calendar!`,
          });
        } else {
          setSyncStatusMsg({ text: 'All events are already synced with Google Calendar.' });
        }
        await fetchData();
      } else {
        setSyncStatusMsg({ text: `Sync error: ${data.error || 'Failed to sync'}`, isError: true });
      }
    } catch (e: any) {
      setSyncStatusMsg({ text: `Sync failed: ${e.message}`, isError: true });
    } finally {
      setIsSyncingNow(false);
    }
  };

  // Open Create Modal
  const openCreateModal = (dateStr: string = selectedDateStr, startTime: string = '09:00') => {
    setEditingEvent(null);
    setModalTitle('');
    setModalDate(dateStr);
    setModalStartTime(startTime);
    // Default 1 hour duration
    const [h, m] = startTime.split(':').map(Number);
    const endH = String(Math.min(23, h + 1)).padStart(2, '0');
    setModalEndTime(`${endH}:${String(m).padStart(2, '0')}`);
    setModalNotes('');
    setModalError(null);
    setIsEventModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setModalTitle(event.title);
    setModalDate(event.event_date);
    setModalStartTime(event.start_time || '09:00');
    setModalEndTime(event.end_time || '10:00');
    setModalNotes(event.notes || '');
    setModalError(null);
    setIsEventModalOpen(true);
  };

  // Save Time Block (Create or Edit)
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = modalTitle.trim();
    if (!cleanTitle) {
      setModalError('Please enter an event title.');
      return;
    }

    setIsSubmittingEvent(true);
    setModalError(null);

    try {
      const userId = await getCurrentUserId();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

      // Calculate duration in minutes
      let durationMinutes = 60;
      if (modalStartTime && modalEndTime) {
        const [sh, sm] = modalStartTime.split(':').map(Number);
        const [eh, em] = modalEndTime.split(':').map(Number);
        durationMinutes = Math.max(15, (eh * 60 + em) - (sh * 60 + sm));
      }

      if (editingEvent) {
        if (editingEvent.source === 'google' && editingEvent.google_event_id) {
          // Update Google Calendar Event
          const gRes = await fetch(`/api/calendar/events/${editingEvent.google_event_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: userId,
              event: {
                title: cleanTitle,
                event_date: modalDate,
                start_time: modalStartTime,
                end_time: modalEndTime,
                notes: modalNotes,
                time_zone: timeZone,
              },
            }),
          });
          if (!gRes.ok) {
            const errTxt = await gRes.text();
            throw new Error(`Google update error: ${errTxt}`);
          }
          fetchGoogleEvents(userId);
        } else {
          // Update Internal Supabase Event
          const { error } = await supabase
            .from('calendar_events')
            .update({
              title: cleanTitle,
              event_date: modalDate,
              start_time: modalStartTime || null,
              end_time: modalEndTime || null,
              duration_minutes: durationMinutes,
              notes: modalNotes || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingEvent.id);

          if (error) throw error;

          // If connected to Google, update the Google event
          if (googleConnected) {
            if (editingEvent.google_event_id) {
              fetch(`/api/calendar/events/${editingEvent.google_event_id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: userId,
                  event: {
                    title: cleanTitle,
                    event_date: modalDate,
                    start_time: modalStartTime,
                    end_time: modalEndTime,
                    notes: modalNotes,
                    time_zone: timeZone,
                  },
                }),
              }).catch(console.error);
            } else {
              // Create in Google if not previously created
              fetch('/api/calendar/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: userId,
                  event: {
                    title: cleanTitle,
                    event_date: modalDate,
                    start_time: modalStartTime,
                    end_time: modalEndTime,
                    notes: modalNotes,
                    time_zone: timeZone,
                  },
                }),
              })
                .then(async (res) => {
                  if (res.ok) {
                    const gData = await res.json();
                    if (gData.googleEvent?.id) {
                      await supabase
                        .from('calendar_events')
                        .update({ google_event_id: gData.googleEvent.id, sync_status: 'synced' })
                        .eq('id', editingEvent.id);
                    }
                  }
                })
                .catch(console.error);
            }
          }
        }
      } else {
        // 1. Create new time block in Supabase first
        const newEventPayload: any = {
          user_id: userId,
          title: cleanTitle,
          event_date: modalDate,
          start_time: modalStartTime || null,
          end_time: modalEndTime || null,
          duration_minutes: durationMinutes,
          notes: modalNotes || null,
          color: '#c7a15a',
          calendar_id: selectedCalendarId || 'primary',
          sync_status: 'pending',
          is_deleted: false,
        };

        const { data: inserted, error: insertError } = await supabase
          .from('calendar_events')
          .insert([newEventPayload])
          .select()
          .single();

        if (insertError) throw insertError;

        // 2. If Google Calendar is connected, push event to Google Calendar immediately
        if (googleConnected && inserted?.id) {
          try {
            const gRes = await fetch('/api/calendar/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: userId,
                event: {
                  ...newEventPayload,
                  time_zone: timeZone,
                },
              }),
            });

            if (gRes.ok) {
              const gData = await gRes.json();
              if (gData.googleEvent?.id) {
                await supabase
                  .from('calendar_events')
                  .update({
                    google_event_id: gData.googleEvent.id,
                    sync_status: 'synced',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', inserted.id);
              }
            } else {
              const errTxt = await gRes.text();
              console.warn('Google Calendar sync warning:', errTxt);
              await supabase
                .from('calendar_events')
                .update({ sync_status: 'failed' })
                .eq('id', inserted.id);
            }
          } catch (ge) {
            console.warn('Could not sync to Google Calendar immediately:', ge);
            await supabase
              .from('calendar_events')
              .update({ sync_status: 'failed' })
              .eq('id', inserted.id);
          }
        }
      }

      setIsEventModalOpen(false);
      setIsSubmittingEvent(false);
      await fetchData();
    } catch (err: any) {
      console.error('Failed to save event:', err);
      setModalError(err?.message || 'Failed to save event.');
      setIsSubmittingEvent(false);
    }
  };

  // Delete Time Block
  const handleDeleteEvent = async (event: CalendarEvent) => {
    if (!confirm(`Delete "${event.title}"?`)) return;

    try {
      const userId = await getCurrentUserId();

      if (event.source === 'google' && event.google_event_id) {
        await fetch(`/api/calendar/events/${event.google_event_id}?userId=${userId}`, {
          method: 'DELETE',
        });
        fetchGoogleEvents(userId);
      } else {
        await supabase
          .from('calendar_events')
          .update({ is_deleted: true, updated_at: new Date().toISOString() })
          .eq('id', event.id);

        if (googleConnected && event.google_event_id) {
          await fetch(`/api/calendar/events/${event.google_event_id}?userId=${userId}`, {
            method: 'DELETE',
          }).catch(console.error);
        }
      }

      setIsEventModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete event:', err);
      fetchData();
    }
  };

  // Combine Internal Events, Scheduled Tasks, and Google Events
  const allEvents = useMemo(() => {
    const list: CalendarEvent[] = [...internalEvents];

    // Map scheduled tasks from planner as calendar items
    scheduledTasks.forEach((task) => {
      list.push({
        id: `task_${task.id}`,
        title: task.title,
        event_date: task.task_date,
        start_time: task.planned_time || null,
        end_time: task.planned_time
          ? `${String(Number(task.planned_time.split(':')[0]) + 1).padStart(2, '0')}:${task.planned_time.split(':')[1]}`
          : null,
        notes: task.notes || null,
        source: 'task',
        is_completed: task.is_completed,
        color: '#10b981',
      });
    });

    // Add Google Events
    googleEvents.forEach((ge) => {
      // Avoid duplicate if already linked via google_event_id
      if (!list.some((le) => le.google_event_id === ge.google_event_id)) {
        list.push(ge);
      }
    });

    return list;
  }, [internalEvents, scheduledTasks, googleEvents]);

  // Date Navigation Helpers
  const navigateDate = (step: number) => {
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);

    if (viewMode === 'month') {
      date.setMonth(date.getMonth() + step);
    } else if (viewMode === 'week') {
      date.setDate(date.getDate() + step * 7);
    } else {
      date.setDate(date.getDate() + step);
    }

    setSelectedDateStr(getLocalDateString(date));
  };

  // Compute Week Days for Week View
  const weekDays = useMemo(() => {
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    const dayOfWeek = curr.getDay(); // 0 is Sunday
    const startOfWeek = new Date(curr);
    startOfWeek.setDate(curr.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      return getLocalDateString(day);
    });
  }, [selectedDateStr]);

  // Compute Month Days for Month View
  const monthMatrix = useMemo(() => {
    const [y, m] = selectedDateStr.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const startDayIndex = firstDay.getDay();

    const daysInMonth = new Date(y, m, 0).getDate();
    const days: (string | null)[] = [];

    for (let i = 0; i < startDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(getLocalDateString(new Date(y, m - 1, d)));
    }
    return days;
  }, [selectedDateStr]);

  return (
    <div className="min-h-full flex flex-col bg-app-bg text-app-text theme-transition">
      {/* Top Header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-app-border">
        {/* Left: View Title & Date Navigation */}
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-lg md:text-xl font-medium tracking-tight text-app-text">
            Calendar
          </h1>

          <div className="h-4 w-px bg-app-border mx-1" />

          {/* Stepper */}
          <div className="flex items-center gap-1 bg-app-surface px-2 py-1 rounded-lg border border-app-border">
            <button
              type="button"
              onClick={() => navigateDate(-1)}
              className="p-1 rounded text-app-text-muted hover:text-app-text"
              title="Previous"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setSelectedDateStr(todayStr)}
              className="px-2 py-0.5 text-xs font-serif font-medium text-app-text hover:text-app-accent"
            >
              {viewMode === 'month'
                ? formatPlannerDate(selectedDateStr, { month: 'long', year: 'numeric' })
                : viewMode === 'week'
                ? `Week of ${formatShortPlannerDate(weekDays[0])}`
                : formatShortPlannerDate(selectedDateStr)}
            </button>

            <button
              type="button"
              onClick={() => navigateDate(1)}
              className="p-1 rounded text-app-text-muted hover:text-app-text"
              title="Next"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: View Mode Toggle, Block Time, Calendar Settings, Theme */}
        <div className="flex items-center gap-2.5">
          {/* View Switcher */}
          <div className="flex items-center bg-app-surface border border-app-border rounded-lg p-0.5 text-xs">
            {(['month', 'week', 'day'] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={cn(
                  'px-2.5 py-1 rounded-md capitalize transition-colors',
                  viewMode === mode
                    ? 'bg-app-accent text-white font-medium shadow-subtle'
                    : 'text-app-text-muted hover:text-app-text'
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* New Event Button */}
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-accent text-white text-xs font-medium hover:opacity-90 transition-opacity shadow-subtle"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Block time</span>
          </button>

          {/* Subtle Calendar Settings Button */}
          <button
            type="button"
            onClick={() => {
              setSyncStatusMsg(null);
              setIsCalendarSettingsOpen(true);
            }}
            className={cn(
              'p-2 rounded-lg border transition-colors relative',
              googleConnected
                ? 'bg-app-surface border-app-border text-app-text hover:border-emerald-500/50'
                : 'bg-app-surface border-app-border text-app-text-muted hover:text-app-text'
            )}
            title="Calendar Settings & Sync"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {googleConnected && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Calendar Views */}
      <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto overflow-auto">
        {/* VIEW 1: MONTH VIEW */}
        {viewMode === 'month' && (
          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-px bg-app-border rounded-xl overflow-hidden border border-app-border">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="bg-app-surface p-2 text-center text-xs font-medium text-app-text-muted">
                  {d}
                </div>
              ))}

              {monthMatrix.map((dateStr, idx) => {
                if (!dateStr) {
                  return <div key={`empty_${idx}`} className="bg-app-bg min-h-[100px] p-1.5 opacity-40" />;
                }

                const dayEvents = allEvents.filter((e) => e.event_date === dateStr);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDateStr;

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={cn(
                      'bg-app-bg min-h-[100px] p-2 flex flex-col transition-colors cursor-pointer hover:bg-app-surface/50 group',
                      isSelected && 'ring-1 ring-app-accent',
                      isToday && 'bg-app-surface/20'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={cn(
                          'text-xs font-mono w-5 h-5 flex items-center justify-center rounded-full',
                          isToday
                            ? 'bg-app-accent text-white font-semibold'
                            : isSelected
                            ? 'text-app-accent font-semibold'
                            : 'text-app-text-muted group-hover:text-app-text'
                        )}
                      >
                        {parseInt(dateStr.slice(8, 10), 10)}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreateModal(dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-app-text-muted hover:text-app-text hover:bg-app-surface transition-opacity"
                        title="Add time block"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[80px]">
                      {dayEvents.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(ev);
                          }}
                          className={cn(
                            'px-1.5 py-0.5 rounded text-[11px] font-sans truncate cursor-pointer transition-transform hover:scale-[1.02]',
                            ev.source === 'task'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : ev.source === 'google'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                              : 'bg-app-accent/10 text-app-accent border border-app-accent/20'
                          )}
                          title={`${ev.start_time || ''} ${ev.title}`}
                        >
                          {ev.start_time && <span className="font-mono mr-1 text-[10px] opacity-75">{ev.start_time}</span>}
                          <span>{ev.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: WEEK VIEW (24H GRID) */}
        {viewMode === 'week' && (
          <div className="border border-app-border rounded-2xl bg-app-surface overflow-hidden flex flex-col">
            {/* Week Header */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-app-border bg-app-surface">
              <div className="p-3 text-center text-[11px] font-mono text-app-text-dim border-r border-app-border">
                GMT
              </div>
              {weekDays.map((dStr) => {
                const isToday = dStr === todayStr;
                const isSelected = dStr === selectedDateStr;
                const d = new Date(dStr);
                const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];

                return (
                  <div
                    key={dStr}
                    onClick={() => setSelectedDateStr(dStr)}
                    className={cn(
                      'p-2.5 text-center border-r last:border-r-0 border-app-border cursor-pointer transition-colors hover:bg-app-bg/50',
                      isSelected && 'bg-app-accent/5'
                    )}
                  >
                    <p className="text-[11px] font-medium text-app-text-muted">{dayName}</p>
                    <p
                      className={cn(
                        'text-sm font-serif font-medium mt-0.5 inline-block w-6 h-6 rounded-full leading-6',
                        isToday ? 'bg-app-accent text-white' : 'text-app-text'
                      )}
                    >
                      {parseInt(dStr.slice(8, 10), 10)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* 24-Hour Grid Scroll Area */}
            <div className="overflow-y-auto max-h-[650px] relative">
              <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
                {/* Hours Left Column */}
                <div className="border-r border-app-border bg-app-surface/50 select-none">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="h-14 border-b border-app-border/40 text-[10px] font-mono text-app-text-dim text-right pr-2 pt-1"
                    >
                      {String(hour).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* 7 Days Columns */}
                {weekDays.map((dStr) => {
                  const dayEvents = allEvents.filter((e) => e.event_date === dStr && e.start_time);
                  const isSelected = dStr === selectedDateStr;

                  return (
                    <div
                      key={dStr}
                      className={cn(
                        'border-r last:border-r-0 border-app-border/40 relative min-h-[1344px]',
                        isSelected && 'bg-app-accent/[0.02]'
                      )}
                    >
                      {/* Hour slots background */}
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          onClick={() => openCreateModal(dStr, `${String(hour).padStart(2, '0')}:00`)}
                          className="h-14 border-b border-app-border/20 hover:bg-app-accent/5 cursor-pointer transition-colors group relative"
                        >
                          <span className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 text-[10px] text-app-accent font-medium">
                            +
                          </span>
                        </div>
                      ))}

                      {/* Positioned Time Blocks */}
                      {dayEvents.map((ev) => {
                        if (!ev.start_time) return null;
                        const [sh, sm] = ev.start_time.split(':').map(Number);
                        const [eh, em] = (ev.end_time || `${sh + 1}:00`).split(':').map(Number);

                        const startMinutes = sh * 60 + sm;
                        const endMinutes = eh * 60 + em;
                        const duration = Math.max(30, endMinutes - startMinutes);

                        const topPixels = (startMinutes / 60) * 56; // 56px per hour
                        const heightPixels = Math.max(26, (duration / 60) * 56);

                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(ev);
                            }}
                            style={{
                              top: `${topPixels}px`,
                              height: `${heightPixels}px`,
                            }}
                            className={cn(
                              'absolute left-1 right-1 p-1.5 rounded-lg border text-xs overflow-hidden cursor-pointer shadow-subtle transition-transform hover:scale-[1.01] hover:z-10',
                              ev.source === 'task'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                : ev.source === 'google'
                                ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                                : 'bg-app-accent/10 border-app-accent/30 text-app-accent'
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-medium truncate text-[11px]">{ev.title}</p>
                              {ev.source === 'task' && <CheckSquare className="w-2.5 h-2.5 shrink-0" />}
                              {ev.source === 'google' && <CalendarIcon className="w-2.5 h-2.5 shrink-0" />}
                            </div>
                            {heightPixels >= 40 && (
                              <p className="text-[10px] font-mono opacity-80 mt-0.5">
                                {ev.start_time} - {ev.end_time || ''}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: DAY VIEW (24H SINGLE DAY) */}
        {viewMode === 'day' && (
          <div className="border border-app-border rounded-2xl bg-app-surface overflow-hidden flex flex-col max-w-3xl mx-auto">
            <div className="p-4 border-b border-app-border bg-app-surface flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-app-text-muted">Single Day Schedule</p>
                <h2 className="font-serif text-base font-medium text-app-text mt-0.5">
                  {formatPlannerDate(selectedDateStr, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => openCreateModal(selectedDateStr)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Block</span>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[650px] relative">
              <div className="grid grid-cols-[70px_1fr] relative min-h-[1344px]">
                {/* Hours Left Column */}
                <div className="border-r border-app-border bg-app-surface/50 select-none">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="h-14 border-b border-app-border/40 text-[11px] font-mono text-app-text-dim text-right pr-2 pt-1"
                    >
                      {String(hour).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* Day Slot */}
                <div className="relative">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      onClick={() => openCreateModal(selectedDateStr, `${String(hour).padStart(2, '0')}:00`)}
                      className="h-14 border-b border-app-border/20 hover:bg-app-accent/5 cursor-pointer transition-colors group relative"
                    >
                      <span className="opacity-0 group-hover:opacity-100 absolute top-1 right-2 text-xs text-app-accent font-medium">
                        + Add block
                      </span>
                    </div>
                  ))}

                  {/* Day Events */}
                  {allEvents
                    .filter((e) => e.event_date === selectedDateStr && e.start_time)
                    .map((ev) => {
                      if (!ev.start_time) return null;
                      const [sh, sm] = ev.start_time.split(':').map(Number);
                      const [eh, em] = (ev.end_time || `${sh + 1}:00`).split(':').map(Number);

                      const startMinutes = sh * 60 + sm;
                      const endMinutes = eh * 60 + em;
                      const duration = Math.max(30, endMinutes - startMinutes);

                      const topPixels = (startMinutes / 60) * 56;
                      const heightPixels = Math.max(30, (duration / 60) * 56);

                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(ev);
                          }}
                          style={{
                            top: `${topPixels}px`,
                            height: `${heightPixels}px`,
                          }}
                          className={cn(
                            'absolute left-3 right-3 p-2.5 rounded-xl border text-xs overflow-hidden cursor-pointer shadow-subtle transition-transform hover:scale-[1.01] hover:z-10',
                            ev.source === 'task'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                              : ev.source === 'google'
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                              : 'bg-app-accent/10 border-app-accent/30 text-app-accent'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-xs truncate">{ev.title}</p>
                            <span className="font-mono text-[11px] opacity-80 shrink-0">
                              {ev.start_time} - {ev.end_time || ''}
                            </span>
                          </div>
                          {ev.notes && (
                            <p className="text-[11px] text-app-text-muted mt-1 truncate">{ev.notes}</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CALENDAR SETTINGS MODAL */}
      {isCalendarSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-elevated p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-app-border pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-app-accent" />
                <h3 className="font-serif text-base font-medium text-app-text">
                  Calendar Settings & Sync
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCalendarSettingsOpen(false)}
                className="p-1 rounded text-app-text-muted hover:text-app-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Google Calendar Section */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-app-text-muted">Google Calendar Integration</label>
                
                {googleConnected ? (
                  <div className="p-3.5 rounded-xl bg-app-bg border border-app-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Google Calendar connected
                        </span>
                      </div>
                      {googleEmail && (
                        <span className="text-[11px] font-mono text-app-text-dim truncate max-w-[150px]">
                          {googleEmail}
                        </span>
                      )}
                    </div>

                    {/* Available Calendars Dropdown */}
                    <div className="space-y-1 pt-2 border-t border-app-border">
                      <label className="text-[11px] font-medium text-app-text-muted">Target Google Calendar</label>
                      <select
                        value={selectedCalendarId}
                        onChange={(e) => handleSelectCalendar(e.target.value)}
                        disabled={isUpdatingCalendarId}
                        className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-xs text-app-text outline-none focus:border-app-accent"
                      >
                        {availableCalendars.length > 0 ? (
                          availableCalendars.map((cal) => (
                            <option key={cal.id} value={cal.id}>
                              {cal.summary} {cal.primary ? '(Primary)' : ''}
                            </option>
                          ))
                        ) : (
                          <option value="primary">Primary Calendar</option>
                        )}
                      </select>
                    </div>

                    {/* Sync Now Action */}
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSyncNow}
                        disabled={isSyncingNow}
                        className="flex-1 py-2 rounded-xl bg-app-surface hover:bg-app-surface-hover border border-app-border text-xs font-medium text-app-text transition-colors flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className={cn('w-3.5 h-3.5 text-app-accent', isSyncingNow && 'animate-spin')} />
                        <span>{isSyncingNow ? 'Syncing...' : 'Sync now'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDisconnectGoogle}
                        className="px-3 py-2 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 text-xs font-medium transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-app-bg border border-app-border space-y-3 text-center sm:text-left">
                    <p className="text-xs text-app-text-muted leading-relaxed">
                      Connect Google Calendar to automatically sync time blocks across devices.
                    </p>
                    <button
                      type="button"
                      onClick={handleConnectGoogle}
                      className="w-full py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>Connect Google Calendar</span>
                    </button>
                  </div>
                )}
              </div>

              {syncStatusMsg && (
                <div
                  className={cn(
                    'p-3 rounded-xl text-xs flex items-center gap-2',
                    syncStatusMsg.isError
                      ? 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
                      : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  {syncStatusMsg.isError ? (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span>{syncStatusMsg.text}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCalendarSettingsOpen(false)}
                className="px-4 py-2 rounded-xl bg-app-surface hover:bg-app-surface-hover border border-app-border text-xs text-app-text font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TIME BLOCK MODAL (CREATE / EDIT) */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-elevated p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-app-border pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-app-accent" />
                <h3 className="font-serif text-base font-medium text-app-text">
                  {editingEvent ? 'Edit Time Block' : 'Block Time'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="p-1 rounded text-app-text-muted hover:text-app-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted">Event / Block Title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="e.g., Focus: Math Homework, Biology Lecture"
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted">Date</label>
                  <input
                    type="date"
                    required
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-2.5 py-2 text-xs text-app-text outline-none focus:border-app-accent font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted">Start Time</label>
                  <input
                    type="time"
                    required
                    value={modalStartTime}
                    onChange={(e) => setModalStartTime(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-2.5 py-2 text-xs text-app-text outline-none focus:border-app-accent font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted">End Time</label>
                  <input
                    type="time"
                    required
                    value={modalEndTime}
                    onChange={(e) => setModalEndTime(e.target.value)}
                    className="w-full bg-app-bg border border-app-border rounded-xl px-2.5 py-2 text-xs text-app-text outline-none focus:border-app-accent font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Additional context or agenda..."
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent resize-none"
                />
              </div>

              <div className="pt-3 border-t border-app-border flex items-center justify-between">
                {editingEvent ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(editingEvent)}
                    className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg text-xs flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEventModalOpen(false)}
                    disabled={isSubmittingEvent}
                    className="px-3 py-1.5 text-xs text-app-text-muted hover:text-app-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEvent}
                    className="px-4 py-1.5 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {isSubmittingEvent ? 'Saving...' : 'Save Block'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GOOGLE CLOUD OAUTH SETUP HANDOFF MODAL */}
      {isSetupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-app-surface border border-app-border rounded-2xl shadow-elevated p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-app-border pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-app-accent" />
                <h3 className="font-serif text-base font-medium text-app-text">
                  Google Calendar OAuth Setup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSetupModalOpen(false)}
                className="p-1 rounded text-app-text-muted hover:text-app-text"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-app-text-muted leading-relaxed">
              <p>
                To connect your Google Calendar via OAuth, follow these 5 quick steps in your Google Cloud Console:
              </p>

              <ol className="list-decimal pl-5 space-y-2 text-app-text">
                <li>
                  Go to <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noreferrer" className="text-app-accent underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="w-3 h-3" /></a> and <strong>Enable Google Calendar API</strong>.
                </li>
                <li>
                  Configure <strong>OAuth Consent Screen</strong>: Choose External, enter app name <em>Grandham</em>, and add your personal email as a <strong>Test user</strong>.
                </li>
                <li>
                  Go to <strong>Credentials</strong> → <strong>Create Credentials</strong> → <strong>OAuth client ID</strong> (Application type: <em>Web application</em>).
                </li>
                <li>
                  In <strong>Authorized redirect URIs</strong>, add this exact URL:
                  <div className="mt-1 p-2 rounded-lg bg-app-bg font-mono text-[11px] text-app-accent select-all break-all border border-app-border">
                    {typeof window !== 'undefined' ? `${window.location.origin}/api/auth/google-calendar/callback` : 'https://grandham.vercel.app/api/auth/google-calendar/callback'}
                  </div>
                </li>
                <li>
                  Copy your <strong>Client ID</strong> & <strong>Client Secret</strong> and add them to your local <code className="font-mono text-app-accent">.env.local</code> file:
                  <pre className="mt-1 p-2 rounded-lg bg-app-bg font-mono text-[11px] text-app-text-dim border border-app-border overflow-x-auto">
{`GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here`}
                  </pre>
                </li>
              </ol>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSetupModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-app-accent text-white text-xs font-medium hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
