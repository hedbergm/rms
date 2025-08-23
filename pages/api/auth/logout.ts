import type { NextApiRequest, NextApiResponse } from 'next';
import { clearAuthCookie } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  clearAuthCookie(res);
  res.json({ ok: true });
}
