import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { debugLog } from '@/lib/utils';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_please_set_JWT_SECRET_in_env'
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      debugLog('error', 'ADMIN_PASSWORD env variable not set');
      return NextResponse.json(
        { success: false, error: 'Admin password not configured. Set ADMIN_PASSWORD in environment.' },
        { status: 500 }
      );
    }

    if (password !== adminPassword) {
      debugLog('warn', 'Failed admin login attempt');
      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Generate JWT
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('24h')
      .setIssuedAt()
      .sign(JWT_SECRET);

    debugLog('success', 'Admin login successful');

    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (err) {
    debugLog('error', 'Admin auth error', err);
    return NextResponse.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
