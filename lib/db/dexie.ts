import Dexie, { Table } from 'dexie';
import {
  Folder,
  Notebook,
  NotebookPage,
  Textbook,
  ListModel,
  Assignment,
  Homework,
  TodayTask,
  SyncQueueRecord,
  AppSettings,
} from '@/types';

export class GrandhamDatabase extends Dexie {
  folders!: Table<Folder, string>;
  notebooks!: Table<Notebook, string>;
  pages!: Table<NotebookPage, string>;
  textbooks!: Table<Textbook, string>;
  lists!: Table<ListModel, string>;
  assignments!: Table<Assignment, string>;
  homeworks!: Table<Homework, string>;
  todayTasks!: Table<TodayTask, string>;
  syncQueue!: Table<SyncQueueRecord, number>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('GrandhamDB');
    this.version(2).stores({
      folders: 'id, parentId, name, isDeleted, createdAt, updatedAt',
      notebooks: 'id, folderId, title, isStickied, isDeleted, createdAt, updatedAt',
      pages: 'id, notebookId, pageNumber, isDeleted, createdAt, updatedAt',
      textbooks: 'id, title, course, isStickied, isDeleted, createdAt, updatedAt',
      lists: 'id, title, category, isDeleted, createdAt, updatedAt',
      assignments: 'id, title, course, status, priority, dueDate, isDeleted, createdAt, updatedAt',
      homeworks: 'id, title, course, status, dueDate, isDeleted, createdAt, updatedAt',
      todayTasks: 'id, date, completed, createdAt',
      syncQueue: '++id, table, recordId, status, timestamp',
      settings: 'key',
    });
  }
}

export const db = new GrandhamDatabase();

// Sync Queue Helper
export async function queueSyncOperation(
  table: string,
  recordId: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: any
) {
  try {
    await db.syncQueue.add({
      table,
      recordId,
      operation,
      payload,
      timestamp: new Date().toISOString(),
      status: 'pending',
    });
  } catch (error) {
    console.error('Failed to queue sync operation:', error);
  }
}

// --- TODAY TASKS ---
export async function dbGetTodayTasks(dateStr: string): Promise<TodayTask[]> {
  try {
    return await db.todayTasks.where('date').equals(dateStr).toArray();
  } catch {
    return [];
  }
}

export async function dbAddTodayTask(dateStr: string, text: string): Promise<TodayTask> {
  const task: TodayTask = {
    id: crypto.randomUUID(),
    date: dateStr,
    text,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  await db.todayTasks.add(task);
  return task;
}

export async function dbToggleTodayTask(id: string): Promise<void> {
  const task = await db.todayTasks.get(id);
  if (task) {
    await db.todayTasks.update(id, { completed: !task.completed });
  }
}

export async function dbDeleteTodayTask(id: string): Promise<void> {
  await db.todayTasks.delete(id);
}

// --- FOLDERS ---
export async function dbCreateFolder(data: Omit<Folder, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): Promise<Folder> {
  const now = new Date().toISOString();
  const folder: Folder = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };
  await db.folders.add(folder);
  await queueSyncOperation('folders', folder.id, 'INSERT', folder);
  return folder;
}

export async function dbUpdateFolder(id: string, updates: Partial<Folder>): Promise<void> {
  const now = new Date().toISOString();
  const fullUpdates = { ...updates, updatedAt: now };
  await db.folders.update(id, fullUpdates);
  const updated = await db.folders.get(id);
  if (updated) {
    await queueSyncOperation('folders', id, 'UPDATE', updated);
  }
}

export async function dbSoftDeleteFolder(id: string): Promise<void> {
  await dbUpdateFolder(id, { isDeleted: true });
}

export async function dbRestoreFolder(id: string): Promise<void> {
  await dbUpdateFolder(id, { isDeleted: false });
}

export async function dbPermanentDeleteFolder(id: string): Promise<void> {
  await db.folders.delete(id);
  await queueSyncOperation('folders', id, 'DELETE', { id });
}

// --- NOTEBOOKS ---
export async function dbCreateNotebook(data: Omit<Notebook, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): Promise<Notebook> {
  const now = new Date().toISOString();
  const notebook: Notebook = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };
  await db.notebooks.add(notebook);

  // Automatically create Page 1 for the new notebook
  const firstPage: NotebookPage = {
    id: crypto.randomUUID(),
    notebookId: notebook.id,
    pageNumber: 1,
    title: 'Page 1',
    template: notebook.defaultTemplate || 'ruled',
    typedContent: { type: 'doc', content: [{ type: 'paragraph' }] },
    drawingStrokes: [],
    images: [],
    urls: [],
    pdfAttachments: [],
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };
  await db.pages.add(firstPage);
  await queueSyncOperation('notebooks', notebook.id, 'INSERT', notebook);
  await queueSyncOperation('pages', firstPage.id, 'INSERT', firstPage);

  return notebook;
}

export async function dbUpdateNotebook(id: string, updates: Partial<Notebook>): Promise<void> {
  const now = new Date().toISOString();
  const fullUpdates = { ...updates, updatedAt: now };
  await db.notebooks.update(id, fullUpdates);
  const updated = await db.notebooks.get(id);
  if (updated) {
    await queueSyncOperation('notebooks', id, 'UPDATE', updated);
  }
}

export async function dbSoftDeleteNotebook(id: string): Promise<void> {
  await dbUpdateNotebook(id, { isDeleted: true });
}

export async function dbRestoreNotebook(id: string): Promise<void> {
  await dbUpdateNotebook(id, { isDeleted: false });
}

export async function dbPermanentDeleteNotebook(id: string): Promise<void> {
  await db.transaction('rw', db.notebooks, db.pages, db.syncQueue, async () => {
    await db.pages.where('notebookId').equals(id).delete();
    await db.notebooks.delete(id);
  });
  await queueSyncOperation('notebooks', id, 'DELETE', { id });
}

// --- PAGES ---
export async function dbAddPage(notebookId: string, template: NotebookPage['template'] = 'ruled'): Promise<NotebookPage> {
  const now = new Date().toISOString();
  const existingPages = await db.pages.where('notebookId').equals(notebookId).filter(p => !p.isDeleted).toArray();
  const nextNumber = existingPages.length + 1;

  const newPage: NotebookPage = {
    id: crypto.randomUUID(),
    notebookId,
    pageNumber: nextNumber,
    title: `Page ${nextNumber}`,
    template,
    typedContent: { type: 'doc', content: [{ type: 'paragraph' }] },
    drawingStrokes: [],
    images: [],
    urls: [],
    pdfAttachments: [],
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };
  await db.pages.add(newPage);
  await queueSyncOperation('pages', newPage.id, 'INSERT', newPage);
  return newPage;
}

export async function dbUpdatePage(id: string, updates: Partial<NotebookPage>): Promise<void> {
  const now = new Date().toISOString();
  const fullUpdates = { ...updates, updatedAt: now };
  await db.pages.update(id, fullUpdates);
  const updated = await db.pages.get(id);
  if (updated) {
    await queueSyncOperation('pages', id, 'UPDATE', updated);
  }
}

export async function dbDuplicatePage(pageId: string): Promise<NotebookPage | null> {
  const original = await db.pages.get(pageId);
  if (!original) return null;

  const pages = await db.pages.where('notebookId').equals(original.notebookId || '').filter(p => !p.isDeleted).toArray();
  const now = new Date().toISOString();
  const duplicate: NotebookPage = {
    ...original,
    id: crypto.randomUUID(),
    pageNumber: pages.length + 1,
    title: `${original.title || 'Page'} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };
  await db.pages.add(duplicate);
  await queueSyncOperation('pages', duplicate.id, 'INSERT', duplicate);
  return duplicate;
}

export async function dbSoftDeletePage(id: string): Promise<void> {
  await dbUpdatePage(id, { isDeleted: true });
}

export async function dbRestorePage(id: string): Promise<void> {
  await dbUpdatePage(id, { isDeleted: false });
}

export async function dbPermanentDeletePage(id: string): Promise<void> {
  await db.pages.delete(id);
  await queueSyncOperation('pages', id, 'DELETE', { id });
}

// --- TEXTBOOKS ---
export async function dbCreateTextbook(data: Omit<Textbook, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): Promise<Textbook> {
  const now = new Date().toISOString();
  const textbook: Textbook = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };
  await db.textbooks.add(textbook);
  await queueSyncOperation('textbooks', textbook.id, 'INSERT', textbook);
  return textbook;
}

export async function dbUpdateTextbook(id: string, updates: Partial<Textbook>): Promise<void> {
  const now = new Date().toISOString();
  const fullUpdates = { ...updates, updatedAt: now };
  await db.textbooks.update(id, fullUpdates);
  const updated = await db.textbooks.get(id);
  if (updated) {
    await queueSyncOperation('textbooks', id, 'UPDATE', updated);
  }
}

// --- LISTS ---
export async function dbCreateList(data: Omit<ListModel, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): Promise<ListModel> {
  const now = new Date().toISOString();
  const list: ListModel = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };
  await db.lists.add(list);
  await queueSyncOperation('lists', list.id, 'INSERT', list);
  return list;
}

export async function dbUpdateList(id: string, updates: Partial<ListModel>): Promise<void> {
  const now = new Date().toISOString();
  const fullUpdates = { ...updates, updatedAt: now };
  await db.lists.update(id, fullUpdates);
  const updated = await db.lists.get(id);
  if (updated) {
    await queueSyncOperation('lists', id, 'UPDATE', updated);
  }
}

// --- ASSIGNMENTS ---
export async function dbCreateAssignment(data: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): Promise<Assignment> {
  const now = new Date().toISOString();
  const assignment: Assignment = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };
  await db.assignments.add(assignment);
  await queueSyncOperation('assignments', assignment.id, 'INSERT', assignment);
  return assignment;
}

export async function dbUpdateAssignment(id: string, updates: Partial<Assignment>): Promise<void> {
  const now = new Date().toISOString();
  const fullUpdates = { ...updates, updatedAt: now };
  await db.assignments.update(id, fullUpdates);
  const updated = await db.assignments.get(id);
  if (updated) {
    await queueSyncOperation('assignments', id, 'UPDATE', updated);
  }
}

// --- HOMEWORKS ---
export async function dbCreateHomework(data: Omit<Homework, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): Promise<Homework> {
  const now = new Date().toISOString();
  const homework: Homework = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };
  await db.homeworks.add(homework);
  await queueSyncOperation('homeworks', homework.id, 'INSERT', homework);
  return homework;
}

export async function dbUpdateHomework(id: string, updates: Partial<Homework>): Promise<void> {
  const now = new Date().toISOString();
  const fullUpdates = { ...updates, updatedAt: now };
  await db.homeworks.update(id, fullUpdates);
  const updated = await db.homeworks.get(id);
  if (updated) {
    await queueSyncOperation('homeworks', id, 'UPDATE', updated);
  }
}
