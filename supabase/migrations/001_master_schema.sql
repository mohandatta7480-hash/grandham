-- ==============================================================================
-- GRANDHAM: Complete Master Database Schema & Storage Configuration
--
-- How to apply:
-- 1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/awmydvjlbhpdxrtagyrv/sql
-- 2. Click "+ New query"
-- 3. Paste this entire SQL block and click "Run"
-- ==============================================================================

-- 0. ENABLE UUID EXTENSION
create extension if not exists "uuid-ossp";

-- ==============================================================================
-- 1. CORE TABLES CREATION (IF NOT EXISTS)
-- ==============================================================================

-- 1.1 SUBJECTS TABLE (Top-level study areas)
create table if not exists public.subjects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
    name text not null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 1.2 FOLDERS TABLE (Folders inside Subjects)
create table if not exists public.folders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
    subject_id uuid references public.subjects(id) on delete cascade not null,
    name text not null,
    color text default '#c7a15a',
    icon text default 'folder',
    is_deleted boolean not null default false,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 1.3 NOTEBOOKS TABLE
create table if not exists public.notebooks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
    subject_id uuid references public.subjects(id) on delete set null,
    folder_id uuid references public.folders(id) on delete set null,
    title text not null,
    description text,
    is_starred boolean not null default false,
    cover_color text default '#19191d',
    default_template text default 'ruled',
    is_deleted boolean not null default false,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 1.4 NOTEBOOK PAGES TABLE (Multi-page block-based notes)
create table if not exists public.notebook_pages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
    notebook_id uuid references public.notebooks(id) on delete cascade not null,
    page_number integer not null default 1,
    title text default 'Page 1',
    template text default 'ruled',
    blocks jsonb default '[]'::jsonb,
    typed_content jsonb default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
    drawing_strokes jsonb default '[]'::jsonb,
    is_deleted boolean not null default false,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 1.5 TEXTBOOKS TABLE (PDF documents & reader annotations)
create table if not exists public.textbooks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
    title text not null,
    file_path text,
    file_url text,
    file_name text,
    page_count integer default 1,
    current_page integer default 1,
    annotations jsonb default '{}'::jsonb,
    is_starred boolean not null default false,
    is_deleted boolean not null default false,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 1.6 TASK LISTS TABLE
create table if not exists public.task_lists (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
    title text,
    list_date text not null, -- YYYY-MM-DD local planner date
    is_deleted boolean not null default false,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 1.7 DAILY TASKS TABLE
create table if not exists public.daily_tasks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
    list_id uuid references public.task_lists(id) on delete cascade,
    title text not null,
    task_date text not null, -- YYYY-MM-DD local date
    planned_time text,       -- HH:mm optional planned time
    notes text,
    is_completed boolean not null default false,
    is_deleted boolean not null default false,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 1.8 CALENDAR EVENTS & TIME BLOCKS TABLE
create table if not exists public.calendar_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
    title text not null,
    event_date text not null, -- YYYY-MM-DD local date
    start_time text,          -- HH:mm
    end_time text,            -- HH:mm
    duration_minutes integer default 60,
    color text default '#c7a15a',
    notes text,
    google_event_id text,
    calendar_id text default 'primary',
    sync_status text default 'synced',
    is_deleted boolean not null default false,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 1.9 USER CALENDAR CONNECTIONS (Google OAuth tokens per user)
create table if not exists public.user_calendar_connections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null unique default auth.uid(),
    provider text not null default 'google',
    email text,
    access_token text not null,
    refresh_token text,
    expires_at bigint not null,
    calendar_id text default 'primary',
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);


-- 1.10 ASSIGNMENTS TABLE (Deliverables, due dates, and problem sets)
create table if not exists public.assignments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
    subject_id uuid references public.subjects(id) on delete set null,
    title text not null,
    due_date text not null, -- YYYY-MM-DD local calendar date
    due_time text,          -- HH:mm optional local time
    notes text,
    status text default 'not_started',
    is_completed boolean not null default false,
    is_deleted boolean not null default false,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- ==============================================================================
-- 2. SAFE COLUMN UPGRADES (IF PRE-EXISTING TABLES LACK COLUMNS)
-- ==============================================================================
alter table public.notebooks add column if not exists folder_id uuid references public.folders(id) on delete set null;
alter table public.notebooks add column if not exists subject_id uuid references public.subjects(id) on delete set null;
alter table public.notebooks add column if not exists is_starred boolean not null default false;
alter table public.notebooks add column if not exists default_template text default 'ruled';
alter table public.notebook_pages add column if not exists blocks jsonb default '[]'::jsonb;
alter table public.calendar_events add column if not exists calendar_id text default 'primary';
alter table public.calendar_events add column if not exists sync_status text default 'synced';
alter table public.calendar_events add column if not exists google_event_id text;
alter table public.user_calendar_connections add column if not exists calendar_id text default 'primary';
alter table public.daily_tasks add column if not exists is_starred boolean not null default false;

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
alter table public.subjects enable row level security;
alter table public.folders enable row level security;
alter table public.notebooks enable row level security;
alter table public.notebook_pages enable row level security;
alter table public.textbooks enable row level security;
alter table public.task_lists enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.user_calendar_connections enable row level security;
alter table public.assignments enable row level security;

-- Drop existing policies if already defined to avoid duplicate errors
drop policy if exists "Users manage own subjects" on public.subjects;
drop policy if exists "Users manage own folders" on public.folders;
drop policy if exists "Users manage own notebooks" on public.notebooks;
drop policy if exists "Users manage own notebook_pages" on public.notebook_pages;
drop policy if exists "Users manage own textbooks" on public.textbooks;
drop policy if exists "Users manage own task_lists" on public.task_lists;
drop policy if exists "Users manage own daily_tasks" on public.daily_tasks;
drop policy if exists "Users manage own calendar_events" on public.calendar_events;
drop policy if exists "Users manage own user_calendar_connections" on public.user_calendar_connections;
drop policy if exists "Users manage own assignments" on public.assignments;

-- Re-create comprehensive CRUD RLS policies
create policy "Users manage own subjects"
    on public.subjects for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users manage own folders"
    on public.folders for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users manage own notebooks"
    on public.notebooks for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users manage own notebook_pages"
    on public.notebook_pages for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users manage own textbooks"
    on public.textbooks for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users manage own task_lists"
    on public.task_lists for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users manage own daily_tasks"
    on public.daily_tasks for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users manage own calendar_events"
    on public.calendar_events for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users manage own user_calendar_connections"
    on public.user_calendar_connections for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users manage own assignments"
    on public.assignments for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- ==============================================================================
-- 4. PERFORMANCE INDEXES
-- ==============================================================================
create index if not exists idx_subjects_user_deleted on public.subjects(user_id, is_deleted);
create index if not exists idx_folders_user_subject on public.folders(user_id, subject_id, is_deleted);
create index if not exists idx_notebooks_user_deleted on public.notebooks(user_id, is_deleted, is_starred);
create index if not exists idx_notebooks_subject on public.notebooks(user_id, subject_id);
create index if not exists idx_notebooks_folder on public.notebooks(user_id, folder_id);
create index if not exists idx_notebook_pages_nb on public.notebook_pages(notebook_id, page_number);
create index if not exists idx_textbooks_user_deleted on public.textbooks(user_id, is_deleted, is_starred);
create index if not exists idx_task_lists_user_date on public.task_lists(user_id, list_date, is_deleted);
create index if not exists idx_daily_tasks_user_date on public.daily_tasks(user_id, task_date, is_deleted);
create index if not exists idx_calendar_events_user_date on public.calendar_events(user_id, event_date, is_deleted);
create index if not exists idx_assignments_user_date on public.assignments(user_id, due_date, is_deleted);
create index if not exists idx_assignments_subject on public.assignments(subject_id);

-- ==============================================================================
-- 5. STORAGE BUCKETS CONFIGURATION (textbooks & note-images)
-- ==============================================================================
insert into storage.buckets (id, name, public)
values ('textbooks', 'textbooks', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do nothing;

-- Textbook bucket policies (Private to user)
drop policy if exists "Users upload own textbooks" on storage.objects;
drop policy if exists "Users view own textbooks" on storage.objects;
drop policy if exists "Users update own textbooks" on storage.objects;
drop policy if exists "Users delete own textbooks" on storage.objects;

create policy "Users upload own textbooks"
    on storage.objects for insert
    with check (bucket_id = 'textbooks' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users view own textbooks"
    on storage.objects for select
    using (bucket_id = 'textbooks' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users update own textbooks"
    on storage.objects for update
    using (bucket_id = 'textbooks' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own textbooks"
    on storage.objects for delete
    using (bucket_id = 'textbooks' and auth.uid()::text = (storage.foldername(name))[1]);

-- Note images bucket policies
drop policy if exists "Users upload own note images" on storage.objects;
drop policy if exists "Anyone views public note images" on storage.objects;
drop policy if exists "Users update own note images" on storage.objects;
drop policy if exists "Users delete own note images" on storage.objects;

create policy "Users upload own note images"
    on storage.objects for insert
    with check (bucket_id = 'note-images');

create policy "Anyone views public note images"
    on storage.objects for select
    using (bucket_id = 'note-images');

create policy "Users update own note images"
    on storage.objects for update
    using (bucket_id = 'note-images');

create policy "Users delete own note images"
    on storage.objects for delete
    using (bucket_id = 'note-images');
