import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromReq } from '../../lib/auth';
import { getAvailability } from '../../lib/availability';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ message: 'Ikke innlogget' });
    const { date, type } = req.query;
    if (!date || typeof date !== 'string') return res.status(400).json({ message: 'Mangler dato' });
    const bookingType = (type === 'UNLOADING') ? 'UNLOADING' : 'LOADING';
    
    // Debug incoming date
    console.log('Incoming date query:', date);
    
    // Explicitly handle the date in local time
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    
    console.log('Parsed date:', d.toISOString(), 'Local:', d.toString());
    
    if (isNaN(d.getTime())) return res.status(400).json({ message: 'Ugyldig dato' });
    const slots = await getAvailability(d, bookingType);
    return res.json(slots);
  } catch (e:any) {
    console.error('Availability error', e);
    return res.status(500).json({ message: 'Feil', error: e?.message || String(e) });
  }
}
