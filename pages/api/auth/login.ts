import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate, signAuthToken, setAuthCookie } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Mangler epost/passord' });
  const user = await authenticate(email, password);
  if (!user) return res.status(401).json({ message: 'Feil epost eller passord' });
  const token = signAuthToken({ userId: user.id, role: user.role, email: user.email });
  setAuthCookie(res, token);
  res.json({ user: { email: user.email, role: user.role } });
}
