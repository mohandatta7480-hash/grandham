import { NextRequest, NextResponse } from 'next/server';
import { getGoogleOAuthUrl } from '@/lib/calendar/googleAuth';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const userId = request.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.',
        code: 'NOT_CONFIGURED',
      },
      { status: 500 }
    );
  }

  const authUrl = getGoogleOAuthUrl(origin, userId);
  return NextResponse.redirect(authUrl);
}
