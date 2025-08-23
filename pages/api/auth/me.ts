import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromReq } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getUserFromReq(req);
  if(!user) return res.status(401).json({});
  res.json({ user: { email: user.email, role: user.role } });
}
