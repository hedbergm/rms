import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromReq } from '../../lib/auth';
import { getAvailability } from '../../lib/availability';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getUserFromReq(req);
  if (!user) return res.status(401).json({ message: 'Ikke innlogget' });
  const { date, type } = req.query;
  if (!date || typeof date !== 'string') return res.status(400).json({ message: 'Mangler dato' });
  const bookingType = (type === 'UNLOADING') ? 'UNLOADING' : 'LOADING';
  const d = new Date(date + 'T00:00:00');
  const slots = await getAvailability(d, bookingType);
  res.json(slots);
}
