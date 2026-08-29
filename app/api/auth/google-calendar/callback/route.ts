import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, fetchGoogleUserEmail } from '@/lib/calendar/googleAuth';
import { supabase } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const userId = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(`${origin}/?hub=calendar&error=${encodeURIComponent(error)}`);
  }

  if (!code || !userId) {
    return NextResponse.redirect(`${origin}/?hub=calendar&error=Missing+authorization+code+or+user+state`);
  }

  try {
    const redirectUri = `${origin}/api/auth/google-calendar/callback`;
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
      return NextResponse.redirect(`${origin}/?hub=calendar&error=Failed+to+save+calendar+credentials`);
    }

    return NextResponse.redirect(`${origin}/?hub=calendar&google_connected=true`);
  } catch (err: any) {
    console.error('Failed in Google OAuth callback:', err);
    return NextResponse.redirect(`${origin}/?hub=calendar&error=${encodeURIComponent(err.message || 'OAuth error')}`);
  }
}
