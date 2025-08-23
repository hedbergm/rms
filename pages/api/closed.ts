import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromReq } from '../../lib/auth';
import { prisma } from '../../lib/prisma';
import { startOfDay } from 'date-fns';

// Manage ClosedSlot entries
export default async function handler(req: NextApiRequest, res: NextApiResponse){
  const user = await getUserFromReq(req);
  if(!user || user.role !== 'ADMIN') return res.status(403).json({ message: 'Ingen tilgang' });

  if(req.method === 'GET') {
    // list range (optional) else upcoming 60d
    const { start, end } = req.query;
    const startDate = start && typeof start==='string' ? startOfDay(new Date(start+'T00:00:00')) : startOfDay(new Date());
    const endDate = end && typeof end==='string' ? startOfDay(new Date(end+'T00:00:00')) : startOfDay(new Date(Date.now()+60*24*60*60*1000));
    // @ts-ignore model added post-migration
    const rows = await (prisma as any).closedSlot.findMany({
      where:{ date: { gte: startDate, lte: endDate } },
      orderBy:{ date:'asc' }
    });
    return res.json(rows);
  }

  if(req.method === 'POST') {
    const { date, type, rampNumber, startMinute, durationMinutes, reason } = req.body || {};
    if(!date || !type) return res.status(400).json({ message: 'Mangler date/type' });
    if(!['LOADING','UNLOADING','BOTH'].includes(type)) return res.status(400).json({ message: 'Ugyldig type' });
    const d = startOfDay(new Date(date+'T00:00:00'));
    // @ts-ignore
    const created = await (prisma as any).closedSlot.create({ data: {
      date: d,
      type,
      rampNumber: rampNumber === null || rampNumber === undefined || rampNumber === '' ? null : Number(rampNumber),
      startMinute: startMinute === null || startMinute === undefined || startMinute === '' ? null : Number(startMinute),
      durationMinutes: durationMinutes === null || durationMinutes === undefined || durationMinutes === '' ? null : Number(durationMinutes),
      reason: reason ? String(reason).slice(0,200) : null
    }});
    return res.json(created);
  }

  if(req.method === 'DELETE') {
    const { id } = req.query;
    if(!id || typeof id !== 'string') return res.status(400).json({ message: 'Mangler id' });
    try {
      // @ts-ignore
      await (prisma as any).closedSlot.delete({ where:{ id } });
      return res.json({ message:'Slettet' });
    } catch(e:any){
      return res.status(404).json({ message:'Ikke funnet' });
    }
  }

  res.status(405).end();
}
