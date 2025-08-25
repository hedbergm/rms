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
    try {
      const { date, type, rampNumber, startMinute, durationMinutes, reason, startTime, endTime } = req.body || {};
      console.log('POST /api/closed body:', JSON.stringify({ date, type, rampNumber, startTime, endTime, reason }));
      if(!date || !type) return res.status(400).json({ message: 'Mangler date/type' });
      if(!['LOADING','UNLOADING','BOTH'].includes(type)) return res.status(400).json({ message: 'Ugyldig type' });
      const d = startOfDay(new Date(date+'T00:00:00'));

    function hmToMinutes(hm:string){
      const m = /^([0-2]?\d):([0-5]\d)$/.exec(hm);
      if(!m) return null; const h = Number(m[1]); const min = Number(m[2]);
      if(h>23) return null; return h*60+min;
    }

    let sMin: number | null = null;
    let dur: number | null = null;

    if(startTime || endTime){
      if(!startTime) return res.status(400).json({ message:'Mangler start tid' });
      const s = hmToMinutes(startTime);
      if(s==null) return res.status(400).json({ message:'Ugyldig start tid' });
      sMin = s;
      if(endTime){
        const e = hmToMinutes(endTime);
        if(e==null) return res.status(400).json({ message:'Ugyldig slutt tid' });
        if(e<=s) return res.status(400).json({ message:'Slutt må være etter start' });
        dur = e - s;
      } else {
        dur = null; // resten av dagen
      }
    } else if(startMinute !== undefined && startMinute !== '' ) {
      const s = Number(startMinute); if(isNaN(s)||s<0||s>24*60) return res.status(400).json({ message:'Ugyldig startMinute' });
      sMin = s;
      if(durationMinutes !== undefined && durationMinutes !== '') {
        const dm = Number(durationMinutes); if(isNaN(dm)||dm<=0) return res.status(400).json({ message:'Ugyldig durationMinutes' });
        dur = dm;
      }
    } else {
      // Hele dagen
      sMin = null; dur = null;
    }

    // @ts-ignore
    const created = await (prisma as any).closedSlot.create({ data: {
      date: d,
      type,
      rampNumber: rampNumber === null || rampNumber === undefined || rampNumber === '' ? null : Number(rampNumber),
      startMinute: sMin,
      durationMinutes: dur,
      reason: reason ? String(reason).slice(0,200) : null
    }});
    console.log('Created ClosedSlot:', JSON.stringify(created));
    return res.json(created);
    } catch (error: any) {
      console.error('Error in POST /api/closed:', error);
      return res.status(500).json({ 
        message: 'Serverfeil',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
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
