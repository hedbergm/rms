import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromReq } from '../../../lib/auth';
import { transporter } from '../../../lib/email';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  const user = await getUserFromReq(req);
  if (!user || user.role !== 'ADMIN') return res.status(403).json({ message: 'Ingen tilgang' });
  try {
    const ok = await transporter.verify();
    return res.json({ ok, message: ok ? 'SMTP forbindelse OK' : 'Verify returnerte false' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message, stack: process.env.NODE_ENV === 'development' ? e.stack : undefined });
  }
}