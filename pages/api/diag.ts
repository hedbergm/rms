import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromReq } from '../../lib/auth';
import { prisma } from '../../lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse){
  try {
    const user = await getUserFromReq(req);
    if(!user || user.role !== 'ADMIN') return res.status(403).json({ message:'Ingen tilgang' });
    const now = new Date();
    const t0 = Date.now();
    // simple query
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const bookingCount = await prisma.booking.count({ where:{ start: { gte: todayStart, lt: todayEnd } } });
    let closedSlotSupported = false; let closedSlotCount: number | null = null; let closedSlotError: string | null = null;
    try {
      const client: any = prisma as any;
      if (client.closedSlot) {
        closedSlotSupported = true;
        closedSlotCount = await client.closedSlot.count({ where:{ date: todayStart } });
      }
    } catch(e:any){ closedSlotError = e.message || String(e); }
    const dbPingMs = Date.now() - t0;
    res.json({
      ok:true,
      time: now.toISOString(),
      commit: process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || null,
      node: process.version,
      dbPingMs,
      bookingCountToday: bookingCount,
      closedSlot: { supported: closedSlotSupported, countToday: closedSlotCount, error: closedSlotError },
      env: {
        databaseUrlPresent: !!process.env.DATABASE_URL,
        smtpUserSet: !!process.env.O365_USER
      }
    });
  } catch(e:any){
    res.status(500).json({ ok:false, error: e.message || String(e) });
  }
}
