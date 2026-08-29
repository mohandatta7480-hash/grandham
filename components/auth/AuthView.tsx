'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { ArrowRight, CheckCircle2, KeyRound, Mail, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthViewProps {
  onContinueAsGuest?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onContinueAsGuest }) => {
  const [authMode, setAuthMode] = useState<'magic' | 'password'>('magic');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setIsSent(true);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        if (data.session) {
          window.location.reload();
        } else {
          setErrorMsg('Account created. Check your email to confirm, or sign in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestEntry = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('grandham_guest_mode', 'true');
      if (!localStorage.getItem('grandham_user_id')) {
        localStorage.setItem('grandham_user_id', crypto.randomUUID());
      }
    }
    if (onContinueAsGuest) {
      onContinueAsGuest();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-app-bg text-app-text theme-transition">
      {/* Top minimal header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-app-border">
        <span className="font-serif text-lg font-medium text-app-text">Grandham</span>
        <ThemeToggle />
      </header>

      {/* Center Sign-in Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center sm:text-left">
            <h1 className="font-serif text-2xl font-medium tracking-tight text-app-text">
              Sign in
            </h1>
            <p className="text-xs text-app-text-muted">
              Personal notes and study space with real-time sync across your devices.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-app-surface p-1 rounded-xl border border-app-border text-xs">
            <button
              type="button"
              onClick={() => {
                setAuthMode('magic');
                setErrorMsg(null);
              }}
              className={cn(
                'flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5',
                authMode === 'magic'
                  ? 'bg-app-accent text-white shadow-subtle'
                  : 'text-app-text-muted hover:text-app-text'
              )}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Magic Link</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('password');
                setErrorMsg(null);
              }}
              className={cn(
                'flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5',
                authMode === 'password'
                  ? 'bg-app-accent text-white shadow-subtle'
                  : 'text-app-text-muted hover:text-app-text'
              )}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Password</span>
            </button>
          </div>

          {/* Magic Link Form */}
          {authMode === 'magic' && (
            isSent ? (
              <div className="p-4 rounded-xl border border-app-border bg-app-surface space-y-2 text-center sm:text-left">
                <div className="flex items-center gap-2 text-xs font-medium text-app-accent">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Magic link sent</span>
                </div>
                <p className="text-xs text-app-text-muted leading-relaxed">
                  Check your inbox at <span className="font-medium text-app-text">{email}</span> and click the link to sign in.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsSent(false);
                    setEmail('');
                  }}
                  className="text-xs text-app-accent hover:underline pt-1 block"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-app-text-muted">Email address</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2.5 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors shadow-subtle"
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-500 font-medium">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl bg-app-accent hover:opacity-90 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-subtle flex items-center justify-center gap-1.5"
                >
                  <span>{isLoading ? 'Sending...' : 'Send magic link'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )
          )}

          {/* Password Form */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordAuth} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted">Email address</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2.5 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors shadow-subtle"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-app-text-muted">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-app-surface border border-app-border rounded-xl px-3.5 py-2.5 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors shadow-subtle"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-500 font-medium">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-app-accent hover:opacity-90 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-subtle flex items-center justify-center gap-1.5"
              >
                <span>{isLoading ? 'Processing...' : isSignUp ? 'Create account' : 'Sign in'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs text-app-text-muted hover:text-app-text underline"
                >
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
            </form>
          )}

          {/* Quick Continue to Workspace */}
          <div className="pt-3 border-t border-app-border text-center space-y-2">
            <button
              type="button"
              onClick={handleGuestEntry}
              className="text-xs text-app-text-muted hover:text-app-accent transition-colors inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-app-accent" />
              <span>Continue to workspace</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
