import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyPassword, createSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    const res = await query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [cleanEmail]);
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const user = res.rows[0];
    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = createSessionToken({ id: user.id, name: user.name, email: user.email });

    const response = NextResponse.json({
      message: 'Login successful',
      user: { id: user.id, name: user.name, email: user.email },
    });

    response.cookies.set('brainsync_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Failed to login' }, { status: 500 });
  }
}
