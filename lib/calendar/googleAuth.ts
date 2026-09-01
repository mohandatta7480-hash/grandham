// Google Calendar OAuth & Token Management Helpers (Server-Side)

import { NextRequest } from 'next/server';

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

/**
 * Resolves the canonical base URL for the application.
 * Priority:
 * 1. Server-side process.env.APP_URL (e.g. https://grandham.vercel.app)
 * 2. process.env.NEXT_PUBLIC_APP_URL
 * 3. process.env.VERCEL_URL (automatically populated on Vercel)
 * 5. Browser runtime origin (window.location.origin)
 * 6. Relative base URL fallback ("")
 */
export function getAppUrl(request?: NextRequest | Request): string {
  // 1. Derive dynamically from incoming request if available
  if (request) {
    try {
      const headers = request.headers;
      const forwardedHost = headers.get('x-forwarded-host');
      const forwardedProto = headers.get('x-forwarded-proto') || 'https';

      if (forwardedHost) {
        return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
      }

      if ('nextUrl' in request && request.nextUrl?.origin && request.nextUrl.origin !== 'null') {
        return request.nextUrl.origin.replace(/\/+$/, '');
      }

      if ('url' in request && request.url) {
        const parsed = new URL(request.url);
        return parsed.origin.replace(/\/+$/, '');
      }
    } catch (e) {
      // Fallback
    }
  }

  // 2. Explicit server-side APP_URL environment variable
  if (process.env.APP_URL) {
    const raw = process.env.APP_URL.trim();
    if (raw) {
      return (raw.startsWith('http://') || raw.startsWith('https://')
        ? raw
        : `https://${raw}`).replace(/\/+$/, '');
    }
  }

  // 3. Vercel deployment URL
  if (process.env.VERCEL_URL) {
    const raw = process.env.VERCEL_URL.trim();
    if (raw) {
      return (raw.startsWith('http://') || raw.startsWith('https://')
        ? raw
        : `https://${raw}`).replace(/\/+$/, '');
    }
  }

  // 4. Client/Server NEXT_PUBLIC_APP_URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const raw = process.env.NEXT_PUBLIC_APP_URL.trim();
    if (raw) {
      return (raw.startsWith('http://') || raw.startsWith('https://')
        ? raw
        : `https://${raw}`).replace(/\/+$/, '');
    }
  }

  // 5. Browser runtime origin
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  // 6. Relative base URL fallback
  return '';
}

export function getGoogleOAuthUrl(appUrl: string, userId: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const base = appUrl ? appUrl.replace(/\/+$/, '') : '';
  const redirectUri = `${base}/api/auth/google-calendar/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: userId,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange Google OAuth code: ${errorText}`);
  }

  return await response.json();
}

export async function refreshGoogleToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Google token: ${errorText}`);
  }

  return await response.json();
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      return data.email || null;
    }
  } catch (e) {
    console.error('Error fetching Google user email:', e);
  }
  return null;
}
