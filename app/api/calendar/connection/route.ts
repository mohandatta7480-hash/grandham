import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');

  const isConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  if (!userId) {
    return NextResponse.json({
      connected: false,
      configured: isConfigured,
    });
  }

  try {
    const { data, error } = await supabase
      .from('user_calendar_connections')
      .select('provider, email, calendar_id, expires_at, created_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({
        connected: false,
        configured: isConfigured,
      });
    }

    return NextResponse.json({
      connected: true,
      configured: isConfigured,
      email: data.email,
      calendarId: data.calendar_id || 'primary',
      provider: data.provider,
    });
  } catch (err) {
    return NextResponse.json({
      connected: false,
      configured: isConfigured,
    });
  }
}

// PATCH: Update selected Google Calendar ID
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, calendarId } = body;

    if (!userId || !calendarId) {
      return NextResponse.json({ error: 'Missing userId or calendarId' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_calendar_connections')
      .update({
        calendar_id: calendarId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true, calendarId });
  } catch (err: any) {
    console.error('Error updating calendar_id:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
