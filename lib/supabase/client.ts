import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://awmydvjlbhpdxrtagyrv.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_XX6UIxML2WV7duZEBzuz4Q_qP_VSffq';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function getSupabaseClient() {
  return supabase;
}

export async function getCurrentUserId(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  } catch (e) {
    console.warn('Error fetching Supabase user session:', e);
  }
  
  if (typeof window !== 'undefined') {
    let localId = localStorage.getItem('grandham_user_id');
    if (!localId) {
      localId = crypto.randomUUID();
      localStorage.setItem('grandham_user_id', localId);
    }
    return localId;
  }
  return '00000000-0000-0000-0000-000000000000';
}

export async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) return user.email;
  } catch (e) {
    // Ignore
  }
  if (typeof window !== 'undefined') {
    return localStorage.getItem('grandham_user_email') || null;
  }
  return null;
}
