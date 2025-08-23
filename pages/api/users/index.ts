import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromReq } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';
import { sendUserCreatedEmail } from '../../../lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const current = await getUserFromReq(req);
  if (!current) return res.status(401).json({ message: 'Ikke innlogget' });
  if (current.role !== 'ADMIN') return res.status(403).json({ message: 'Ingen tilgang' });

  if (req.method === 'POST') {
    let { email, password, role } = req.body || {};
    if (!email || typeof email !== 'string') return res.status(400).json({ message: 'Mangler epost' });
    email = email.trim().toLowerCase();
    // Enkel epost-sjekk
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ message: 'Ugyldig epost' });
    // Rolle (valgfri). Kun ADMIN eller USER.
    let userRole: 'ADMIN' | 'USER' = 'USER';
    if (role && typeof role === 'string') {
      const r = role.toUpperCase();
      if (r === 'ADMIN' || r === 'USER') userRole = r as any;
      else return res.status(400).json({ message: 'Ugyldig rolle' });
    }

    const passwordPlain: string = password && typeof password === 'string' && password.length >= 8
      ? password
      : (Math.random().toString(36).slice(-10) + '!');

    try {
  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  const user = await prisma.user.create({ data: { email, passwordHash, role: userRole } });
      // Send epost (ikke fatal om det feiler)
      try { await sendUserCreatedEmail(email, passwordPlain); } catch (mailErr) { console.warn('Epost feilet:', mailErr); }
  return res.json({ user: { id: user.id, email: user.email, role: user.role }, password: passwordPlain });
    } catch (e: any) {
      if (e.code === 'P2002') {
        return res.status(400).json({ message: 'Bruker finnes allerede' });
      }
      console.error('Create user error', e);
      return res.status(500).json({ message: 'Kunne ikke opprette bruker (serverfeil)' });
    }
  }
  if (req.method === 'GET') {
    const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, createdAt: true } });
    return res.json(users);
  }
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ message: 'Mangler id' });
    // Optional: hindre at man sletter seg selv
    if (id === current.id) return res.status(400).json({ message: 'Kan ikke slette deg selv' });
    try {
      // Slett først relaterte bookinger (pga referanse)
      await prisma.booking.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } });
      return res.json({ message: 'Slettet' });
    } catch (e: any) {
      if (e.code === 'P2025') return res.status(404).json({ message: 'Bruker ikke funnet' });
      console.error('Delete user error', e);
      return res.status(500).json({ message: 'Kunne ikke slette bruker' });
    }
  }
  res.status(405).end();
}
