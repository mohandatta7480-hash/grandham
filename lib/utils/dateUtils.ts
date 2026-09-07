// Device Local Timezone Date Utilities (No UTC Shifts)

/**
 * Returns the local date string in YYYY-MM-DD format using the user's local timezone.
 * Never uses toISOString() or UTC methods to avoid timezone shift bugs.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD date string for display in local time.
 * e.g. "Friday, August 28, 2026"
 */
export function formatPlannerDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }
): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3) return dateStr;
  const [year, month, day] = parts;
  // Create Date using local constructor (year, monthIndex, day)
  const localDate = new Date(year, month - 1, day);
  return localDate.toLocaleDateString('en-US', options);
}

/**
 * Formats a YYYY-MM-DD date string with weekday, month, and day (without year).
 * e.g. "Friday, August 28"
 */
export function formatShortPlannerDate(dateStr: string): string {
  return formatPlannerDate(dateStr, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Checks relative relation to today (Today, Tomorrow, Yesterday, or Short Date)
 */
export function getDateRelativeLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Today';

  const [y1, m1, d1] = dateStr.split('-').map(Number);
  const [y2, m2, d2] = todayStr.split('-').map(Number);
  const date1 = new Date(y1, m1 - 1, d1);
  const date2 = new Date(y2, m2 - 1, d2);
  const diffDays = Math.round((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return formatPlannerDate(dateStr, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Retrieves the set of starred task IDs saved in localStorage.
 */
export function getLocalStarredTaskIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('grandham_starred_tasks');
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

/**
 * Saves or removes a task ID from localStorage starred task set.
 */
export function setLocalTaskStarred(id: string, isStarred: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    const set = getLocalStarredTaskIds();
    if (isStarred) {
      set.add(id);
    } else {
      set.delete(id);
    }
    localStorage.setItem('grandham_starred_tasks', JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn('Failed to save starred tasks to localStorage:', e);
  }
}
