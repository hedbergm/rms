import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromReq } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { getDurationMinutes, validateSlot } from '../../../lib/availability';
import { sendBookingConfirmationEmail } from '../../../lib/email';
import { addMinutes } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'Ikke innlogget' });

  if (req.method === 'GET') {
    const { date } = req.query;
    if (!date || typeof date !== 'string') return res.status(400).json({ message: 'Mangler dato' });
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = addMinutes(startOfDay, (24*60)-1);
    const bookings = await prisma.booking.findMany({
      where: { start: { gte: startOfDay, lte: endOfDay } },
      include: { user: { select: { email: true } } },
      orderBy: { start: 'asc' }
    });
    return res.json(bookings);
  }

  if (req.method === 'POST') {
  const { type, rampNumber, start, regNr, company, email, phone, goodsType, reference } = req.body || {};
    if (!type || !rampNumber || !start || !regNr || !company || !email || !phone || !goodsType) {
      return res.status(400).json({ message: 'Mangler felter' });
    }
    const startDate = new Date(start);
    // Ikke helg (lørdag=6, søndag=0 i getDay?) Merk: JS getDay(): 0=Sunday,6=Saturday
    const day = startDate.getDay();
    if (day === 0 || day === 6) {
      return res.status(400).json({ message: 'Kan ikke booke i helg' });
    }
    // 1-times cutoff: må bookes minst 60 min før start
    const now = new Date();
    const minStart = new Date(now.getTime() + 60 * 60 * 1000);
    if (startDate < minStart) {
      return res.status(400).json({ message: 'For sent å booke denne tiden (må være >= 1 time før)' });
    }
    if (!validateSlot(type, rampNumber, startDate)) return res.status(400).json({ message: 'Ugyldig slot' });
    const duration = getDurationMinutes(type);
    const endDate = addMinutes(startDate, duration);
    try {
  const bookingData: any = { type, rampNumber, start: startDate, end: endDate, regNr, company, email, phone, goodsType, reference: reference && String(reference).trim() || null, userId: user.id };
  const booking = await prisma.booking.create({ data: bookingData });
  // send epost (ikke fatal om feiler)
  try { await sendBookingConfirmationEmail(booking as any); } catch (mailErr) { console.warn('Booking epost feilet:', mailErr); }
  return res.json(booking);
    } catch (e:any) {
      return res.status(400).json({ message: 'Slot allerede booket' });
    }
  }
  if (req.method === 'DELETE') {
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Ingen tilgang' });
    const { id } = req.query;
    if (!id || typeof id !== 'string') return res.status(400).json({ message: 'Mangler id' });
    try {
      await prisma.booking.delete({ where: { id } });
      return res.json({ message: 'Slettet' });
    } catch (e:any) {
      return res.status(404).json({ message: 'Ikke funnet' });
    }
  }
  res.status(405).end();
}
