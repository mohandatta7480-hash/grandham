'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Wifi,
  WifiOff,
  Download,
  Settings as SettingsIcon,
  CheckCircle2,
  AlertCircle,
  CloudOff,
} from 'lucide-react';
import { SyncState, subscribeToSyncState, performSync } from '@/lib/supabase/syncEngine';
import { cn } from '@/lib/utils';

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenSettings: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  title,
  subtitle,
  searchQuery,
  setSearchQuery,
  onOpenSettings,
}) => {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSynced, setLastSynced] = useState<string | undefined>();
  const [syncError, setSyncError] = useState<string | undefined>();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToSyncState((state, lastTime, err) => {
      setSyncState(state);
      setLastSynced(lastTime);
      setSyncError(err);
    });

    // PWA beforeinstallprompt handler
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const handleManualSync = async () => {
    await performSync();
  };

  const renderSyncBadge = () => {
    switch (syncState) {
      case 'syncing':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-mono animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="hidden sm:inline">Syncing...</span>
          </div>
        );
      case 'synced':
        return (
          <div
            onClick={handleManualSync}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono cursor-pointer hover:bg-emerald-500/25 transition-colors"
            title={`Synced with Cloud at ${lastSynced ? new Date(lastSynced).toLocaleTimeString() : 'now'}. Click to re-sync.`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cloud Synced</span>
          </div>
        );
      case 'offline':
        return (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono"
            title="You are currently offline. Changes are safely saved locally in IndexedDB."
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Offline (Saved)</span>
          </div>
        );
      case 'error':
        return (
          <div
            onClick={handleManualSync}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono cursor-pointer hover:bg-rose-500/25 transition-colors"
            title={syncError || 'Sync failed. Click to retry.'}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync Error</span>
          </div>
        );
      case 'unconfigured':
      default:
        return (
          <div
            onClick={handleManualSync}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dark-900 border border-slate-800 text-slate-400 text-xs font-mono cursor-pointer hover:text-slate-200 transition-colors"
            title="Local-only storage (IndexedDB). Supabase sync not configured or idle."
          >
            <CloudOff className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Local Storage</span>
          </div>
        );
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 py-3 bg-dark-950/80 backdrop-blur-xl border-b border-slate-800/80">
      {/* Title & Subtitle */}
      <div>
        <h2 className="text-base md:text-lg font-bold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 font-normal">{subtitle}</p>}
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-md mx-4 hidden sm:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, textbooks, checklists, assignments..."
            className="w-full bg-dark-900/90 border border-slate-800/90 rounded-xl pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
          />
        </div>
      </div>

      {/* Actions: Sync Badge, Install PWA, Settings */}
      <div className="flex items-center gap-2 md:gap-3">
        {renderSyncBadge()}

        {isInstallable && (
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-glow transition-all"
            title="Install GRANDHAM as Desktop/Tablet App"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Install App</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="App & Sync Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
