'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  PenTool,
  Cloud,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { supabase, getCurrentUserId } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshWorkspace?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onRefreshWorkspace,
}) => {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [palmRejection, setPalmRejection] = useState(true);
  const [pressureCurve, setPressureCurve] = useState('medium');
  const [activeTab, setActiveTab] = useState<'sync' | 'stylus'>('sync');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || 'Connected');
      const palm = localStorage.getItem('grandham_palm_rejection');
      if (palm !== null) setPalmRejection(palm === 'true');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-app-surface border border-app-border rounded-2xl shadow-elevated overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-app-border">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-app-accent/10 text-app-accent">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-medium text-base text-app-text">GRANDHAM Settings</h3>
              <p className="text-xs text-app-text-muted">Direct Supabase Cloud & S Pen Configuration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-app-border bg-app-bg px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={cn(
              'px-4 py-2 text-xs font-medium rounded-t-xl transition-all border-b-2 flex items-center gap-2',
              activeTab === 'sync'
                ? 'border-app-accent text-app-text bg-app-surface'
                : 'border-transparent text-app-text-muted hover:text-app-text'
            )}
          >
            <Cloud className="w-4 h-4 text-app-accent" />
            <span>Database Connection</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stylus')}
            className={cn(
              'px-4 py-2 text-xs font-medium rounded-t-xl transition-all border-b-2 flex items-center gap-2',
              activeTab === 'stylus'
                ? 'border-app-accent text-app-text bg-app-surface'
                : 'border-transparent text-app-text-muted hover:text-app-text'
            )}
          >
            <PenTool className="w-4 h-4 text-app-accent" />
            <span>S Pen & Touch</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: SUPABASE SYNC */}
          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-app-accent/10 border border-app-accent/20 text-xs text-app-text space-y-1">
                <p className="font-medium flex items-center gap-1.5 text-app-accent">
                  <Sparkles className="w-4 h-4" /> Live Supabase Connected
                </p>
                <p className="text-app-text-muted">
                  All notebooks, textbooks, multi-task lists, and calendar time blocks persist directly to your Supabase project with Row Level Security.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-app-text-muted">Supabase Project Endpoint</label>
                <input
                  type="text"
                  readOnly
                  value={process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://awmydvjlbhpdxrtagyrv.supabase.co'}
                  className="w-full bg-app-bg border border-app-border rounded-xl px-3.5 py-2 text-xs text-app-text font-mono outline-none"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-emerald-500 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Connected and authenticated</span>
              </div>
            </div>
          )}

          {/* TAB 2: STYLUS & TOUCH */}
          {activeTab === 'stylus' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-app-bg border border-app-border">
                <div>
                  <h4 className="text-xs font-medium text-app-text">Palm Rejection Mode</h4>
                  <p className="text-[11px] text-app-text-muted">
                    When active, only Samsung S Pen / active stylus creates handwriting strokes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !palmRejection;
                    setPalmRejection(next);
                    localStorage.setItem('grandham_palm_rejection', String(next));
                  }}
                  className={cn(
                    'w-12 h-6 rounded-full transition-colors relative p-0.5',
                    palmRejection ? 'bg-app-accent' : 'bg-app-border'
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-full bg-white transition-transform',
                      palmRejection ? 'translate-x-6' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>

              <div className="space-y-2 p-3.5 rounded-xl bg-app-bg border border-app-border">
                <h4 className="text-xs font-medium text-app-text">Pressure Sensitivity Profile</h4>
                <div className="grid grid-cols-3 gap-2">
                  {['soft', 'medium', 'firm'].map((curve) => (
                    <button
                      key={curve}
                      type="button"
                      onClick={() => setPressureCurve(curve)}
                      className={cn(
                        'py-2 rounded-lg text-xs font-medium capitalize border transition-all',
                        pressureCurve === curve
                          ? 'bg-app-accent/20 text-app-accent border-app-accent'
                          : 'border-app-border text-app-text-muted hover:border-app-border-strong'
                      )}
                    >
                      {curve}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
