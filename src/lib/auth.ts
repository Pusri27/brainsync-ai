import { NextRequest } from 'next/server';
import crypto from 'crypto';

const SECRET_KEY = process.env.JWT_SECRET || 'brainsync-ai-secure-secret-key-2026';

export interface UserSession {
  id: string;
  name: string;
  email: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch (err) {
    return false;
  }
}

export function createSessionToken(user: UserSession): string {
  const payload = JSON.stringify({
    id: user.id,
    name: user.name,
    email: user.email,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): UserSession | null {
  try {
    if (!token || !token.includes('.')) return null;
    const [encodedPayload, signature] = token.split('.');
    const expectedSignature = crypto.createHmac('sha256', SECRET_KEY).update(encodedPayload).digest('base64url');
    
    if (signature !== expectedSignature) return null;

    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson);

    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
    };
  } catch (err) {
    return null;
  }
}

export function getAuthUser(req: NextRequest): UserSession | null {
  const token = req.cookies.get('brainsync_auth_token')?.value || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifySessionToken(token);
}
