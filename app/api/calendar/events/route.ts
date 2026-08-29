import { NextRequest, NextResponse } from 'next/server';
import { getGoogleConnectionDetails } from '@/lib/calendar/tokenHelper';

// GET: Fetch Google Calendar Events
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  const timeMin = searchParams.get('timeMin');
  const timeMax = searchParams.get('timeMax');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const details = await getGoogleConnectionDetails(userId);
  if (!details || !details.token) {
    return NextResponse.json({ error: 'Not connected to Google Calendar' }, { status: 401 });
  }

  try {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    if (timeMin) params.append('timeMin', timeMin);
    if (timeMax) params.append('timeMax', timeMax);

    const calendarId = encodeURIComponent(details.calendarId || 'primary');
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${details.token}` },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ items: data.items || [] });
  } catch (err: any) {
    console.error('Error fetching Google Calendar events:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Create Google Calendar Event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, event } = body;

    if (!userId || !event) {
      return NextResponse.json({ error: 'Missing userId or event body' }, { status: 400 });
    }

    const details = await getGoogleConnectionDetails(userId);
    if (!details || !details.token) {
      return NextResponse.json({ error: 'Not connected to Google Calendar' }, { status: 401 });
    }

    const timeZone = event.time_zone || 'Asia/Kolkata';

    // Prepare Google Event payload
    const googlePayload: any = {
      summary: event.title,
      description: event.notes || undefined,
    };

    if (event.start_time && event.end_time) {
      googlePayload.start = {
        dateTime: `${event.event_date}T${event.start_time}:00`,
        timeZone,
      };
      googlePayload.end = {
        dateTime: `${event.event_date}T${event.end_time}:00`,
        timeZone,
      };
    } else {
      googlePayload.start = { date: event.event_date };
      googlePayload.end = { date: event.event_date };
    }

    const calendarId = encodeURIComponent(details.calendarId || 'primary');
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${details.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googlePayload),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    const createdGoogleEvent = await response.json();
    return NextResponse.json({ googleEvent: createdGoogleEvent });
  } catch (err: any) {
    console.error('Error creating Google Calendar event:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
