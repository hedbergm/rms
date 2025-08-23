import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';
import { serialize } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const COOKIE_NAME = 'rms_token';

// Accept any string from DB but narrow to allowed values when issuing token
export interface AuthTokenPayload { userId: string; role: 'ADMIN' | 'USER'; email: string; }

function toRole(role: string): 'ADMIN' | 'USER' {
  return role === 'ADMIN' ? 'ADMIN' : 'USER';
}

export function signAuthToken(payload: { userId: string; role: string; email: string }) {
  const normalized: AuthTokenPayload = { userId: payload.userId, role: toRole(payload.role), email: payload.email };
  return jwt.sign(normalized, JWT_SECRET, { expiresIn: '8h' });
}

export function setAuthCookie(res: NextApiResponse, token: string) {
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8,
  }));
}

export function clearAuthCookie(res: NextApiResponse) {
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, '', { path: '/', maxAge: 0 }));
}

export async function getUserFromReq(req: NextApiRequest) {
  try {
    const token = (req as any).cookies?.[COOKIE_NAME];
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return null;
    return user;
  } catch {
    return null;
  }
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return null;
  return user;
}
