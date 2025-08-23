import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserFromReq } from '../../../lib/auth';
import { transporter } from '../../../lib/email';

// Simple endpoint to verify SMTP works. Requires ADMIN auth.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const user = await getUserFromReq(req);
  if (!user || user.role !== 'ADMIN') return res.status(403).json({ message: 'Ingen tilgang' });

  const to = (req.body?.to as string) || user.email;
  const from = process.env.MAIL_FROM || process.env.O365_USER || 'no-reply@example.com';

  if (!process.env.O365_USER || !process.env.O365_PASS) {
    return res.status(400).json({ message: 'SMTP ikke konfigurert (mangler O365_USER / O365_PASS)' });
  }
  try {
    await transporter.sendMail({
      from,
      to,
      subject: 'RMS epost test',
      text: 'Dette er en test for å bekrefte at SMTP fungerer.'
    });
    return res.json({ ok: true, sentTo: to });
  } catch (e:any) {
    console.error('Test email failed', e);
    return res.status(500).json({ message: 'Epost feilet', error: e.message });
  }
}
