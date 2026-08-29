import { NextRequest, NextResponse } from 'next/server';
import { getGoogleConnectionDetails } from '@/lib/calendar/tokenHelper';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, timeZone = 'Asia/Kolkata' } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const details = await getGoogleConnectionDetails(userId);
    if (!details || !details.token) {
      return NextResponse.json({ error: 'Not connected to Google Calendar' }, { status: 401 });
    }

    // Fetch all active calendar events for this user that lack a google_event_id or have pending/failed sync
    const { data: events, error: fetchErr } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .or('google_event_id.is.null,sync_status.neq.synced');

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const unsynced = events || [];
    let syncedCount = 0;
    const errors: Array<{ eventId: string; title: string; error: string }> = [];

    const calendarId = encodeURIComponent(details.calendarId || 'primary');

    for (const ev of unsynced) {
      try {
        const googlePayload: any = {
          summary: ev.title,
          description: ev.notes || undefined,
        };

        if (ev.start_time && ev.end_time) {
          googlePayload.start = {
            dateTime: `${ev.event_date}T${ev.start_time}:00`,
            timeZone,
          };
          googlePayload.end = {
            dateTime: `${ev.event_date}T${ev.end_time}:00`,
            timeZone,
          };
        } else {
          googlePayload.start = { date: ev.event_date };
          googlePayload.end = { date: ev.event_date };
        }

        // If event already has google_event_id, update it via PATCH; otherwise create via POST
        if (ev.google_event_id) {
          const updateRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(ev.google_event_id)}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${details.token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(googlePayload),
            }
          );

          if (updateRes.ok) {
            await supabase
              .from('calendar_events')
              .update({ sync_status: 'synced', updated_at: new Date().toISOString() })
              .eq('id', ev.id);
            syncedCount++;
          } else {
            const errTxt = await updateRes.text();
            errors.push({ eventId: ev.id, title: ev.title, error: errTxt });
            await supabase
              .from('calendar_events')
              .update({ sync_status: 'failed' })
              .eq('id', ev.id);
          }
        } else {
          const createRes = await fetch(
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

          if (createRes.ok) {
            const created = await createRes.json();
            await supabase
              .from('calendar_events')
              .update({
                google_event_id: created.id,
                sync_status: 'synced',
                updated_at: new Date().toISOString(),
              })
              .eq('id', ev.id);
            syncedCount++;
          } else {
            const errTxt = await createRes.text();
            errors.push({ eventId: ev.id, title: ev.title, error: errTxt });
            await supabase
              .from('calendar_events')
              .update({ sync_status: 'failed' })
              .eq('id', ev.id);
          }
        }
      } catch (err: any) {
        errors.push({ eventId: ev.id, title: ev.title, error: err.message || 'Sync failed' });
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      totalUnsynced: unsynced.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('Error during calendar sync:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
