'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, KeyRound, UserPlus, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthViewProps {
  onContinueAsGuest?: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onContinueAsGuest }) => {
  const [tab, setTab] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Handle Log In
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMsg(error.message || 'Invalid email or password.');
        setIsLoading(false);
        return;
      }

      if (data.session) {
        // Session active - app listener will transition into app
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred during log in.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Create Account
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: origin,
        },
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to create account.');
        setIsLoading(false);
        return;
      }

      // If session is returned, user is immediately authenticated
      if (data.session) {
        // Active session established
        return;
      }

      // If signup succeeded without immediate session, sign in directly with the same credentials
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError) {
        setErrorMsg('Account created. Please log in with your credentials.');
        setTab('login');
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred during account creation.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Password Reset Request
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: origin ? `${origin}/?reset_password=true` : undefined,
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to send password reset request.');
      } else {
        setSuccessMsg(`Password reset email sent to ${cleanEmail}. Check your inbox for further instructions.`);
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      setErrorMsg(err.message || 'Failed to request password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-app-bg text-app-text theme-transition">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-app-border">
        <span className="font-serif text-lg font-medium text-app-text">Grandham</span>
        <ThemeToggle />
      </header>

      {/* Main Authentication Container */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* Title and Intro */}
          <div className="space-y-1 text-center sm:text-left">
            <h1 className="font-serif text-2xl font-medium tracking-tight text-app-text">
              {tab === 'login' && 'Log in'}
              {tab === 'signup' && 'Create account'}
              {tab === 'forgot' && 'Reset password'}
            </h1>
            <p className="text-xs text-app-text-muted">
              {tab === 'login' && 'Enter your email and password to access your workspace.'}
              {tab === 'signup' && 'Create a new personal study workspace with real-time sync.'}
              {tab === 'forgot' && 'Enter your account email to receive a password reset link.'}
            </p>
          </div>

          {/* Tab Selector (Log in vs Create account) */}
          {tab !== 'forgot' && (
            <div className="flex bg-app-surface p-1 rounded-2xl border border-app-border text-xs shadow-subtle">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={cn(
                  'flex-1 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                  tab === 'login'
                    ? 'bg-app-accent text-white shadow-subtle font-semibold'
                    : 'text-app-text-muted hover:text-app-text'
                )}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log in</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTab('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={cn(
                  'flex-1 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer',
                  tab === 'signup'
                    ? 'bg-app-accent text-white shadow-subtle font-semibold'
                    : 'text-app-text-muted hover:text-app-text'
                )}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create account</span>
              </button>
            </div>
          )}

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* 1. Log In Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-app-text">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-app-surface border border-app-border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors shadow-subtle"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-app-text">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] text-app-accent hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-app-surface border border-app-border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors shadow-subtle"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-app-accent hover:opacity-90 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-subtle flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                <span>{isLoading ? 'Signing in...' : 'Log in'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* 2. Create Account Form */}
          {tab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-app-text">Email address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-app-surface border border-app-border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors shadow-subtle"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-app-text">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-app-surface border border-app-border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors shadow-subtle"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-app-text">Confirm password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-app-surface border border-app-border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors shadow-subtle"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-app-accent hover:opacity-90 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-subtle flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                <span>{isLoading ? 'Creating account...' : 'Create account'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* 3. Password Reset Form */}
          {tab === 'forgot' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-app-text">Account email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-app-text-muted pointer-events-none" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-app-surface border border-app-border rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-app-text placeholder-app-text-dim outline-none focus:border-app-accent transition-colors shadow-subtle"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-app-accent hover:opacity-90 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-subtle flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{isLoading ? 'Sending reset link...' : 'Send reset link'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-app-text-muted hover:text-app-text underline cursor-pointer"
                >
                  Back to Log in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
