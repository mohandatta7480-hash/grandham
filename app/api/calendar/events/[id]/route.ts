import { NextRequest, NextResponse } from 'next/server';
import { getGoogleConnectionDetails } from '@/lib/calendar/tokenHelper';

// PATCH: Update Google Calendar Event
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, event } = body;

    if (!userId || !id || !event) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const details = await getGoogleConnectionDetails(userId);
    if (!details || !details.token) {
      return NextResponse.json({ error: 'Not connected to Google Calendar' }, { status: 401 });
    }

    const timeZone = event.time_zone || 'Asia/Kolkata';

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
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
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

    const updated = await response.json();
    return NextResponse.json({ googleEvent: updated });
  } catch (err: any) {
    console.error('Error updating Google Calendar event:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Delete Google Calendar Event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId || !id) {
      return NextResponse.json({ error: 'Missing userId or event id' }, { status: 400 });
    }

    const details = await getGoogleConnectionDetails(userId);
    if (!details || !details.token) {
      return NextResponse.json({ error: 'Not connected to Google Calendar' }, { status: 401 });
    }

    const calendarId = encodeURIComponent(details.calendarId || 'primary');
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${details.token}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting Google Calendar event:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
