'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { NavHub, Notebook, NotebookPage, Textbook } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { Sidebar } from '@/components/layout/Sidebar';
import { HomeHub } from '@/components/hubs/HomeHub';
import { NotebooksHub } from '@/components/hubs/NotebooksHub';
import { SubjectsHub } from '@/components/hubs/SubjectsHub';
import { TextbooksHub } from '@/components/hubs/TextbooksHub';
import { StickiedHub } from '@/components/hubs/StickiedHub';
import { ListHub } from '@/components/hubs/ListHub';
import { CalendarHub } from '@/components/hubs/CalendarHub';
import { RecycleBinHub } from '@/components/hubs/RecycleBinHub';
import { AssignmentsHub } from '@/components/hubs/AssignmentsHub';
import { NotebookViewer } from '@/components/notebook/NotebookViewer';
import { TextbookViewer } from '@/components/textbook/TextbookViewer';
import { AuthView } from '@/components/auth/AuthView';
import { CreateModal } from '@/components/modals/CreateModal';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import type { User } from '@supabase/supabase-js';

export default function GrandhamApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeHub, setActiveHub] = useState<NavHub>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Active Viewers
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [activeTextbook, setActiveTextbook] = useState<Textbook | null>(null);
  const [notebookPages, setNotebookPages] = useState<NotebookPage[]>([]);

  // Creation modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createInitialType, setCreateInitialType] = useState<'notebook' | 'textbook'>('notebook');
  const [refreshKey, setRefreshKey] = useState(0);

  // Check URL search parameters on load (e.g. ?hub=calendar)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hubParam = params.get('hub');
      if (hubParam && ['home', 'notebooks', 'subjects', 'textbooks', 'stickied', 'list', 'calendar', 'assignments', 'homeworks', 'recycle'].includes(hubParam)) {
        setActiveHub(hubParam as NavHub);
      }
      if (localStorage.getItem('grandham_guest_mode') === 'true') {
        setIsGuest(true);
      }
    }
  }, []);

  // Monitor Supabase Authentication
  useEffect(() => {
    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (isMounted) {
          setUser(session?.user ?? null);
          setIsAuthLoading(false);
        }
      })
      .catch((err) => {
        console.warn('getSession error:', err);
        if (isMounted) {
          setIsAuthLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
        setIsAuthLoading(false);
      }
    });

    // Safety timeout: Never leave the screen in a loading lock
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsAuthLoading(false);
      }
    }, 800);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('grandham_guest_mode');
    }
    setUser(null);
    setIsGuest(false);
  };

  const handleOpenCreateModal = (type: 'notebook' | 'textbook' = 'notebook') => {
    setCreateInitialType(type);
    setIsCreateOpen(true);
  };

  const handleCreatedItem = () => {
    setRefreshKey((k) => k + 1);
  };

  // Load pages from Supabase when opening a notebook
  const handleOpenNotebook = async (notebook: Notebook) => {
    try {
      const { data: supaPages } = await supabase
        .from('notebook_pages')
        .select('*')
        .eq('notebook_id', notebook.id)
        .eq('is_deleted', false)
        .order('page_number', { ascending: true });

      if (supaPages && supaPages.length > 0) {
        setNotebookPages(supaPages);
      } else {
        setNotebookPages([]);
      }
      setActiveNotebook(notebook);
    } catch (err) {
      console.error('Failed to load notebook pages from Supabase:', err);
    }
  };

  const handleRefreshNotebook = useCallback(async () => {
    if (!activeNotebook) return;
    const { data: supaPages } = await supabase
      .from('notebook_pages')
      .select('*')
      .eq('notebook_id', activeNotebook.id)
      .eq('is_deleted', false)
      .order('page_number', { ascending: true });

    if (supaPages) setNotebookPages(supaPages);
  }, [activeNotebook]);

  // Update textbook in Supabase
  const handleUpdateTextbook = async (updates: Partial<Textbook>) => {
    if (!activeTextbook) return;
    const updated = { ...activeTextbook, ...updates };
    setActiveTextbook(updated);

    try {
      await supabase
        .from('textbooks')
        .update(updates)
        .eq('id', activeTextbook.id);
    } catch (e) {
      console.error('Failed to update textbook in Supabase:', e);
    }
  };

  // Show quick smooth loader while restoring persistent session from localStorage
  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-app-bg text-app-text space-y-3 theme-transition">
        <span className="font-serif text-base text-app-text-muted animate-pulse">
          Grandham
        </span>
      </div>
    );
  }

  // If no persistent session exists, render the email/password AuthView
  if (!user && !isGuest) {
    return <AuthView onContinueAsGuest={() => setIsGuest(true)} />;
  }

  // Active Multi-Page Notebook Viewer
  if (activeNotebook) {
    return (
      <NotebookViewer
        notebook={activeNotebook}
        pages={notebookPages}
        onBack={() => setActiveNotebook(null)}
        onRefresh={handleRefreshNotebook}
      />
    );
  }

  // Active Page-based PDF Reader & Annotation Viewer
  if (activeTextbook) {
    return (
      <TextbookViewer
        textbook={activeTextbook}
        onBack={() => setActiveTextbook(null)}
        onUpdateTextbook={handleUpdateTextbook}
      />
    );
  }

  return (
    <div className="h-screen flex bg-app-bg text-app-text overflow-hidden theme-transition">
      {/* Refined Minimal Left Sidebar */}
      <Sidebar
        activeHub={activeHub}
        setActiveHub={setActiveHub}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      {/* Main Hub Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {activeHub === 'home' && (
            <HomeHub
              key={refreshKey}
              userEmail={user?.email || 'Personal Workspace'}
              onOpenCreateModal={handleOpenCreateModal}
              onSignOut={handleSignOut}
              onOpenNotebook={handleOpenNotebook}
            />
          )}

          {activeHub === 'notebooks' && (
            <NotebooksHub onOpenNotebook={handleOpenNotebook} />
          )}

          {activeHub === 'subjects' && (
            <SubjectsHub onOpenNotebook={handleOpenNotebook} />
          )}

          {activeHub === 'textbooks' && (
            <TextbooksHub onOpenTextbook={setActiveTextbook} />
          )}

          {activeHub === 'stickied' && (
            <StickiedHub onOpenNotebook={handleOpenNotebook} />
          )}

          {activeHub === 'list' && <ListHub />}

          {activeHub === 'calendar' && <CalendarHub />}

          {activeHub === 'recycle' && <RecycleBinHub />}

          {activeHub === 'assignments' && <AssignmentsHub />}

          {activeHub === 'homeworks' && (
            <div className="min-h-full flex flex-col bg-app-bg text-app-text theme-transition">
              <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-app-border">
                <h1 className="font-serif text-lg md:text-xl font-medium tracking-tight text-app-text">
                  Homeworks
                </h1>
                <div className="flex items-center gap-3">
                  <ThemeToggle />
                </div>
              </header>
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-app-text-dim font-serif text-xs italic">
                Homeworks section is quiet.
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Quick Creation Dialog */}
      <CreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        initialType={createInitialType}
        onCreated={handleCreatedItem}
      />
    </div>
  );
}
