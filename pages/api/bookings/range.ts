import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromReq } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { addDays, startOfDay } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'Ikke innlogget' });
  if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Ingen tilgang' });

  const { start, days } = req.query;
  if (!start || typeof start !== 'string') return res.status(400).json({ message: 'Mangler start' });
  const startDate = startOfDay(new Date(start + 'T00:00:00'));
  const spanDays = Math.min(Math.max(parseInt(days as string) || 7, 1), 31);
  const endDate = addDays(startDate, spanDays);
  const bookings = await prisma.booking.findMany({
    where: { start: { gte: startDate, lt: endDate } },
    include: { user: { select: { email: true } } },
    orderBy: { start: 'asc' }
  });
  res.json({ start: startDate.toISOString(), days: spanDays, bookings });
}
