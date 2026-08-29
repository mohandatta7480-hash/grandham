import { NextRequest, NextResponse } from 'next/server';
import { getGoogleConnectionDetails } from '@/lib/calendar/tokenHelper';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const details = await getGoogleConnectionDetails(userId);
  if (!details || !details.token) {
    return NextResponse.json({ error: 'Not connected to Google Calendar' }, { status: 401 });
  }

  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: { Authorization: `Bearer ${details.token}` },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    const data = await response.json();
    const items = (data.items || []).map((cal: any) => ({
      id: cal.id,
      summary: cal.summary || cal.id,
      description: cal.description || null,
      primary: Boolean(cal.primary),
      backgroundColor: cal.backgroundColor || null,
      selected: cal.id === details.calendarId,
    }));

    return NextResponse.json({ calendars: items, selectedCalendarId: details.calendarId });
  } catch (err: any) {
    console.error('Error fetching calendar list:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
