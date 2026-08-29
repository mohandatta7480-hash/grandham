'use client';

import React from 'react';
import { NavHub } from '@/types';
import {
  Home,
  BookOpen,
  Layers,
  GraduationCap,
  Star,
  CheckSquare,
  Calendar as CalendarIcon,
  ClipboardList,
  BookMarked,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeHub: NavHub;
  setActiveHub: (hub: NavHub) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeHub,
  setActiveHub,
  isCollapsed,
  setIsCollapsed,
}) => {
  const navItems = [
    { hub: 'home' as NavHub, label: 'Home', icon: Home },
    { hub: 'notebooks' as NavHub, label: 'Notebooks', icon: BookOpen },
    { hub: 'subjects' as NavHub, label: 'Subjects', icon: Layers },
    { hub: 'textbooks' as NavHub, label: 'Textbooks', icon: GraduationCap },
    { hub: 'stickied' as NavHub, label: 'Stickied Notebook', icon: Star },
    { hub: 'list' as NavHub, label: 'List', icon: CheckSquare },
    { hub: 'calendar' as NavHub, label: 'Calendar', icon: CalendarIcon },
    { hub: 'assignments' as NavHub, label: 'Assignments', icon: ClipboardList },
    { hub: 'homeworks' as NavHub, label: 'Homeworks', icon: BookMarked },
    { hub: 'recycle' as NavHub, label: 'Recycle Bin', icon: Trash2 },
  ];

  return (
    <aside
      className={cn(
        'h-screen flex flex-col bg-app-surface border-r border-app-border theme-transition z-40 select-none flex-shrink-0',
        isCollapsed ? 'w-16' : 'w-60 md:w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-app-border">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <span className="font-serif tracking-tight text-base font-medium text-app-text">
              Grandham
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'p-1.5 rounded-md text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors',
            isCollapsed && 'mx-auto'
          )}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeHub === item.hub;

          return (
            <button
              key={item.hub}
              type="button"
              onClick={() => setActiveHub(item.hub)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-normal transition-all text-left group',
                isActive
                  ? 'bg-app-surface-hover text-app-text font-medium shadow-subtle'
                  : 'text-app-text-muted hover:text-app-text hover:bg-app-surface-hover/60'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon
                className={cn(
                  'w-4 h-4 flex-shrink-0 transition-colors',
                  isActive ? 'text-app-accent' : 'text-app-text-dim group-hover:text-app-text-muted'
                )}
                strokeWidth={1.75}
              />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
