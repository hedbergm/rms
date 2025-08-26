import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromReq } from '../../lib/auth';
import { prisma } from '../../lib/prisma';
import { startOfDay } from 'date-fns';

function hmToMinutes(hm: string): number | null {
  const m = /^([0-2]?\d):([0-5]\d)$/.exec(hm);
  if(!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if(h>23) return null;
  return h*60+min;
}

// Manage ClosedSlot entries
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Auth check
    const user = await getUserFromReq(req);
    if(!user || user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Ingen tilgang' });
    }

    // Table existence check
    const [{ exists }] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'ClosedSlot'
      );
    ` as [{ exists: boolean }];

    if (!exists) {
      console.error('ClosedSlot table does not exist!');
      return res.status(500).json({ error: 'Database not properly migrated' });
    }
    
    // Handle methods
    if (req.method === 'GET') {
      const { start, end } = req.query;
      const startDate = start && typeof start==='string' ? startOfDay(new Date(start+'T00:00:00')) : startOfDay(new Date());
      const endDate = end && typeof end==='string' ? startOfDay(new Date(end+'T00:00:00')) : startOfDay(new Date(Date.now()+60*24*60*60*1000));
      
      // @ts-ignore
      const rows = await prisma.closedSlot.findMany({
        where:{ date: { gte: startDate, lte: endDate } },
        orderBy:{ date:'asc' }
      });
      
      return res.json(rows || []);
    }
    
    if (req.method === 'POST') {
      const { date, type, rampNumber, reason, startTime, endTime } = req.body || {};
      
      if(!date || !type) {
        return res.status(400).json({ message: 'Mangler date/type' });
      }
      if(!['LOADING','UNLOADING','BOTH'].includes(type)) {
        return res.status(400).json({ message: 'Ugyldig type' });
      }
      
      const d = startOfDay(new Date(date+'T00:00:00'));
      let sMin: number | null = null;
      let dur: number | null = null;

      // Parse time range if provided
      if(startTime) {
        const s = hmToMinutes(startTime);
        if(s === null) {
          return res.status(400).json({ message:'Ugyldig start tid' });
        }
        sMin = s;
        
        if(endTime) {
          const e = hmToMinutes(endTime);
          if(e === null) {
            return res.status(400).json({ message:'Ugyldig slutt tid' });
          }
          if(e <= s) {
            return res.status(400).json({ message:'Slutt må være etter start' });
          }
          dur = e - s;
        }
      }

      // Create the closed slot
      // @ts-ignore
      const created = await prisma.closedSlot.create({ 
        data: {
          date: d,
          type,
          rampNumber: rampNumber === null || rampNumber === undefined || rampNumber === '' ? null : Number(rampNumber),
          startMinute: sMin,
          durationMinutes: dur,
          reason: reason ? String(reason).slice(0,200) : null
        }
      });
      
      return res.json(created);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if(!id || typeof id !== 'string') {
        return res.status(400).json({ message: 'Mangler id' });
      }
      try {
        // @ts-ignore
        await prisma.closedSlot.delete({ where:{ id } });
        return res.json({ message:'Slettet' });
      } catch(e) {
        return res.status(404).json({ message:'Ikke funnet' });
      }
    }

    return res.status(405).end();
  } catch (error: any) {
    console.error('Error in /api/closed:', error);
    return res.status(500).json({ 
      message: 'Serverfeil',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
