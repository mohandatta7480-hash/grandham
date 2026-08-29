// Helper to get a valid Google Access Token (refreshing if expired)

import { supabase } from '@/lib/supabase/client';
import { refreshGoogleToken } from './googleAuth';

export interface GoogleConnectionDetails {
  token: string;
  calendarId: string;
  email: string | null;
  provider: string;
}

export async function getGoogleConnectionDetails(userId: string): Promise<GoogleConnectionDetails | null> {
  const { data, error } = await supabase
    .from('user_calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const now = Date.now();
  let accessToken = data.access_token;

  // If expires in less than 2 minutes, refresh it
  if (data.expires_at - now < 120000 && data.refresh_token) {
    try {
      const refreshed = await refreshGoogleToken(data.refresh_token);
      const newExpiresAt = Date.now() + (refreshed.expires_in || 3600) * 1000;

      await supabase
        .from('user_calendar_connections')
        .update({
          access_token: refreshed.access_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      accessToken = refreshed.access_token;
    } catch (e) {
      console.error('Failed to auto-refresh Google token:', e);
    }
  }

  return {
    token: accessToken,
    calendarId: data.calendar_id || 'primary',
    email: data.email || null,
    provider: data.provider || 'google',
  };
}

export async function getValidGoogleAccessToken(userId: string): Promise<string | null> {
  const details = await getGoogleConnectionDetails(userId);
  return details ? details.token : null;
}
