import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, fetchGoogleUserEmail, getAppUrl } from '@/lib/calendar/googleAuth';
import { supabase } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request);
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const userId = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL(`/?hub=calendar&error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/?hub=calendar&error=Missing+authorization+code+or+user+state', request.url));
  }

  try {
    const redirectUri = `${appUrl}/api/auth/google-calendar/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    const email = await fetchGoogleUserEmail(tokens.access_token);
    const expiresAt = Date.now() + (tokens.expires_in || 3600) * 1000;

    // Upsert connection into Supabase
    const { error: dbError } = await supabase
      .from('user_calendar_connections')
      .upsert(
        {
          user_id: userId,
          provider: 'google',
          email: email || null,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: expiresAt,
          calendar_id: 'primary',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (dbError) {
      console.error('Failed to save Google Calendar connection in Supabase:', dbError);
      return NextResponse.redirect(new URL('/?hub=calendar&error=Failed+to+save+calendar+credentials', request.url));
    }

    return NextResponse.redirect(new URL('/?hub=calendar&google_connected=true', request.url));
  } catch (err: any) {
    console.error('Failed in Google OAuth callback:', err);
    return NextResponse.redirect(new URL(`/?hub=calendar&error=${encodeURIComponent(err.message || 'OAuth error')}`, request.url));
  }
}
