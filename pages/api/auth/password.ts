import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromReq } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import bcrypt from 'bcryptjs';

/*
  PUT /api/auth/password
  Body (self change): { currentPassword: string, newPassword: string }
  Body (admin reset other): { targetEmail: string, newPassword: string }
*/
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT' && req.method !== 'POST') return res.status(405).end();
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'Ikke innlogget' });

  const { currentPassword, newPassword, targetEmail } = req.body || {};
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ message: 'Nytt passord må være minst 8 tegn' });
  }

  if (targetEmail) {
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Ingen tilgang' });
    const target = await prisma.user.findUnique({ where: { email: String(targetEmail).toLowerCase() } });
    if (!target) return res.status(404).json({ message: 'Bruker finnes ikke' });
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: target.id }, data: { passwordHash } });
    return res.json({ ok: true });
  }

  if (!currentPassword) return res.status(400).json({ message: 'Mangler nåværende passord' });
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(400).json({ message: 'Feil nåværende passord' });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ ok: true });
}
