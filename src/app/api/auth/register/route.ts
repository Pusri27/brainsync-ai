import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, createSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 400 });
    }

    const passwordHash = hashPassword(password);
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const res = await query(
      `INSERT INTO users (id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, created_at`,
      [userId, name.trim(), cleanEmail, passwordHash]
    );

    const user = res.rows[0];
    const token = createSessionToken({ id: user.id, name: user.name, email: user.email });

    const response = NextResponse.json({
      message: 'Registration successful',
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
    console.error('Registration error:', error);
    return NextResponse.json({ error: error.message || 'Failed to register' }, { status: 500 });
  }
}
