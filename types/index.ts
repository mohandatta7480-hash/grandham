// Core Data Types for GRANDHAM Notes Application

export type NavHub = 
  | 'home'
  | 'notebooks'
  | 'subjects'
  | 'textbooks'
  | 'stickied'
  | 'list'
  | 'calendar'
  | 'assignments'
  | 'homeworks'
  | 'recycle';

export interface CalendarEvent {
  id: string;
  user_id?: string;
  title: string;
  event_date: string; // YYYY-MM-DD local date
  start_time?: string | null; // HH:mm
  end_time?: string | null; // HH:mm
  duration_minutes?: number;
  color?: string;
  notes?: string | null;
  google_event_id?: string | null;
  calendar_id?: string | null;
  sync_status?: 'synced' | 'pending' | 'failed' | null;
  source?: 'local' | 'task' | 'google';
  is_completed?: boolean;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserCalendarConnection {
  id: string;
  user_id: string;
  provider: 'google';
  email?: string | null;
  access_token: string;
  refresh_token?: string | null;
  expires_at: number;
  calendar_id?: string;
  created_at?: string;
  updated_at?: string;
}

export type PageTemplate = 'blank' | 'ruled' | 'grid' | 'dotted' | 'cornell' | 'blueprint';

export interface Subject {
  id: string;
  user_id?: string;
  name: string;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TaskList {
  id: string;
  user_id?: string;
  title?: string;
  list_date: string; // YYYY-MM-DD local date
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Notebook {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  is_starred?: boolean;
  subject_id?: string | null;
  folder_id?: string | null;
  cover_color?: string;
  coverColor?: string;
  coverGradient?: string;
  coverIcon?: string;
  isStickied?: boolean;
  folderId?: string | null;
  tags?: string[];
  defaultTemplate?: PageTemplate;
  default_template?: PageTemplate;
  is_deleted?: boolean;
  isDeleted?: boolean;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  pageCount?: number;
}

export interface NotebookPage {
  id: string;
  user_id?: string;
  notebook_id?: string;
  notebookId?: string;
  page_number?: number;
  pageNumber?: number;
  title?: string;
  template?: PageTemplate;
  blocks?: PageBlock[];
  typed_content?: any;
  typedContent?: any;
  drawing_strokes?: any[];
  drawingStrokes?: any[];
  images?: PageMediaImage[];
  urls?: PageUrlEmbed[];
  pdfAttachments?: PdfAttachment[];
  is_deleted?: boolean;
  isDeleted?: boolean;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Textbook {
  id: string;
  user_id?: string;
  title: string;
  file_path?: string;
  file_url?: string;
  file_name?: string;
  fileName?: string;
  fileData?: string;
  page_count?: number;
  pageCount?: number;
  current_page?: number;
  currentPage?: number;
  bookmarks?: number[];
  annotations?: Record<number, any>;
  is_starred?: boolean;
  isStickied?: boolean;
  is_deleted?: boolean;
  isDeleted?: boolean;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyTask {
  id: string;
  user_id?: string;
  list_id?: string | null;
  title: string;
  task_date: string; // YYYY-MM-DD
  planned_time?: string | null; // HH:mm
  notes?: string | null;
  is_completed: boolean;
  is_time_blocked?: boolean;
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TodayTask {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  completed: boolean;
  createdAt: string;
}

export type PageBlockType = 'text' | 'drawing' | 'image';

export interface TextBlockContent {
  html?: string;
  json?: any;
}

export interface DrawingBlockContent {
  strokes: DrawingStroke[];
  height?: number;
}

export interface ImageBlockContent {
  url: string;
  caption?: string;
  altText?: string;
  size?: 'small' | 'medium' | 'large' | 'full';
}

export interface PageBlock {
  id: string;
  type: PageBlockType;
  content: TextBlockContent | DrawingBlockContent | ImageBlockContent | any;
}

export interface Folder {
  id: string;
  user_id?: string;
  subject_id: string;
  name: string;
  color?: string;
  icon?: string;
  is_deleted?: boolean;
  isDeleted?: boolean;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
  tiltX?: number;
  tiltY?: number;
  time?: number;
}

export interface DrawingToolOption {
  id: DrawingTool;
  label: string;
}

export type DrawingTool = 'pen' | 'fountain' | 'highlighter' | 'pencil' | 'eraser' | 'line' | 'rect' | 'circle';

export interface DrawingStroke {
  id: string;
  tool: DrawingTool;
  color: string;
  size: number;
  opacity: number;
  points: StrokePoint[];
}

export interface PageMediaImage {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  caption?: string;
}

export interface PageUrlEmbed {
  id: string;
  url: string;
  title: string;
  description?: string;
  favicon?: string;
  image?: string;
  x?: number;
  y?: number;
}

export interface PdfAttachment {
  id: string;
  name: string;
  size: number;
  dataUrl?: string;
  remoteUrl?: string;
  pageCount?: number;
}

export interface ListItem {
  id: string;
  text: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  createdAt: string;
}

export interface ListModel {
  id: string;
  title: string;
  category: 'Daily' | 'Study' | 'Project' | 'Personal' | 'Other';
  color: string;
  items: ListItem[];
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export type AssignmentStatus = 'not_started' | 'in_progress' | 'submitted' | 'graded' | 'completed';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

export interface Assignment {
  id: string;
  user_id?: string;
  subject_id?: string | null;
  title: string;
  course?: string;
  description?: string;
  notes?: string | null;
  due_date?: string;
  dueDate?: string;
  due_time?: string | null;
  status?: AssignmentStatus;
  priority?: PriorityLevel;
  grade?: string;
  notebookId?: string | null;
  is_completed?: boolean;
  isCompleted?: boolean;
  is_deleted?: boolean;
  isDeleted?: boolean;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Homework {
  id: string;
  title: string;
  course: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'submitted';
  instructions?: string;
  attachments?: PdfAttachment[];
  notebookId?: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

export interface RecycleBinItem {
  id: string;
  type: 'notebook' | 'textbook' | 'subject' | 'list';
  title: string;
  deleted_at: string;
  data: any;
}

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SyncQueueRecord {
  id?: number;
  table: string;
  recordId: string;
  operation: SyncOperation;
  payload: any;
  timestamp: string;
  status: 'pending' | 'processing' | 'synced' | 'failed';
  errorMessage?: string;
}

export interface AppSettings {
  id?: string;
  theme: 'dark' | 'light';
  palmRejection: boolean;
  sPenPressureEnabled: boolean;
  smoothingEnabled: boolean;
  autoSaveIntervalMs: number;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  lastSyncedAt?: string;
}
