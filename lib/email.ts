import nodemailer, { SendMailOptions } from 'nodemailer';
import { format } from 'date-fns';
import fs from 'fs';
import path from 'path';

const host = process.env.O365_HOST || 'smtp.office365.com';
const port = parseInt(process.env.O365_PORT || '587', 10);
const secure = process.env.O365_SECURE === 'true';
const user = process.env.O365_USER;
const pass = process.env.O365_PASS;
// Desired visible from email (may be a shared mailbox / alias)
const configuredFrom = process.env.MAIL_FROM || user || 'no-reply@example.com';
const fromName = process.env.MAIL_FROM_NAME || 'HOLSHIP RMS';
const replyTo = process.env.MAIL_REPLY_TO; // optional override
// Build display friendly from header
function buildFrom(address: string) {
  // If address already has a name part, don't wrap again
  return /</.test(address) ? address : `${fromName} <${address}>`;
}
const bcc = process.env.MAIL_BCC; // valgfri kopi for interne varsler

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: user && pass ? { user, pass } : undefined,
});

async function sendWithFallback(opts: SendMailOptions) {
  if (!user || !pass) {
    console.warn('SMTP not configured; skipping email.');
    return;
  }
  // First attempt using configuredFrom
  const primaryFrom = buildFrom(configuredFrom);
  try {
    await transporter.sendMail({
      ...opts,
      from: primaryFrom,
      replyTo: replyTo || opts.replyTo,
    });
  } catch (err: any) {
    const msg: string = err?.response || err?.message || '';
    const isSendAsDenied = /SendAsDenied/i.test(msg);
    const alreadyTriedUser = configuredFrom.toLowerCase() === (user || '').toLowerCase();
    if (isSendAsDenied && !alreadyTriedUser) {
      console.warn('SendAsDenied for', configuredFrom, '- retrying with authenticated user address');
      await transporter.sendMail({
        ...opts,
        from: buildFrom(user!),
        // Keep original desired alias as reply-to if different
        replyTo: replyTo || (configuredFrom !== user ? configuredFrom : undefined) || opts.replyTo,
      });
      return;
    }
    throw err;
  }
}

export async function sendUserCreatedEmail(to: string, password: string) {
  const plain = `Velkommen som bruker av Holship RMS.\n\nBruker: ${to}\nPassord: ${password}\n\nLogg inn og endre passord snarest.\nVed problemer eller behov for hjelp, kontakt : mhe@holship.com`;
  const html = buildBaseHtml({
    title: 'Tilgang opprettet',
    intro: 'Velkommen som bruker av Holship RMS.',
    rows: [
      ['Bruker', to],
      ['Mid. passord', password]
    ],
  // Bruk newline i stedet for <br/> så vi unngår at <br/> vises som tekst
  outro: 'Logg inn og endre passord snarest.\nVed problemer eller behov for hjelp, kontakt : mhe@holship.com'
  });
  await sendWithFallback({
    to,
    subject: 'Tilgang til HOLSHIP RMS',
    text: plain,
    html,
  });
}

export interface BookingLike {
  id: string;
  type: string; // LOADING | UNLOADING
  rampNumber: number;
  start: Date;
  end: Date;
  regNr: string;
  company: string;
  email: string;
  phone: string;
  goodsType: string; // IFCO | GEN_CARGO
  reference?: string | null;
}

export async function sendBookingConfirmationEmail(booking: BookingLike) {
  const startStr = format(booking.start, 'yyyy-MM-dd HH:mm');
  const endStr = format(booking.end, 'HH:mm');
  const subject = `Booking bekreftelse HOLSHIP – ${booking.type === 'LOADING' ? 'Lasting' : 'Lossing'} Rampe ${booking.rampNumber} ${startStr}`;
  const plain = [
    'Din booking er registrert:',
    '',
    `Type: ${booking.type}`,
    `Rampe: ${booking.rampNumber}`,
    `Tid: ${startStr}-${endStr}`,
    `Reg.nr: ${booking.regNr}`,
    `Firma: ${booking.company}`,
    `Godstype: ${booking.goodsType}`,
    `Telefon: ${booking.phone}`,
    booking.reference ? `Referanse: ${booking.reference}` : undefined,
    '',
    'Vennligst møt opp til booket tid.',
    'Kontakt hnw@holship.com ved endringer i god tid før booket tid.'
  ].filter(Boolean).join('\n');
  const html = buildBaseHtml({
    title: 'Booking bekreftet',
    intro: 'Din booking er registrert.',
    rows: [
      ['Type', booking.type === 'LOADING' ? 'Lasting' : 'Lossing'],
      ['Rampe', String(booking.rampNumber)],
      ['Tid', `${startStr} – ${endStr}`],
      ['Reg.nr', booking.regNr],
      ['Firma', booking.company],
      ['Godstype', booking.goodsType],
      ['Telefon', booking.phone],
      booking.reference ? ['Referanse', booking.reference] : null,
      ['Booking ID', booking.id]
    ].filter(Boolean) as [string,string][],
    outro: 'Vennligst møt opp til booket tid. Kontakt hnw@holship.com ved endringer i god tid før booket tid.'
  });
  await sendWithFallback({
    to: booking.email,
    bcc: bcc || undefined,
    subject,
    text: plain,
    html,
  });
}

// ---- HTML helpers ----
interface HtmlTemplateOpts {
  title: string;
  intro?: string;
  rows?: [string, string][];
  // Newlines (\n) in outro will be converted to <br/>
  outro?: string;
}

const brandColor = process.env.MAIL_BRAND_COLOR || '#0f172a'; // slate-900
const accentColor = process.env.MAIL_ACCENT_COLOR || '#2563eb'; // blue-600
const templateWidth = parseInt(process.env.MAIL_TEMPLATE_WIDTH || '420', 10); // default 420px (30% narrower than 600)
const logoMaxHeight = parseInt(process.env.MAIL_LOGO_MAX_HEIGHT || '20', 10);

function escapeHtml(v: string) {
  return v.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]!));
}

function buildBaseHtml(opts: HtmlTemplateOpts) {
  // Lazy load and cache logo as data URI (PNG/JPG/SVG)
  let logoDataUri: string | undefined;
  const logoPath = process.env.MAIL_LOGO_PATH || 'HHvitLogo.png';
  const absLogoPath = path.resolve(process.cwd(), logoPath);
  if (fs.existsSync(absLogoPath)) {
    try {
      const buf = fs.readFileSync(absLogoPath);
      // naive mime detection
      const mime = logoPath.toLowerCase().endsWith('.png') ? 'image/png' : logoPath.toLowerCase().endsWith('.jpg') || logoPath.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : logoPath.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png';
      const b64 = buf.toString('base64');
      logoDataUri = `data:${mime};base64,${b64}`;
    } catch (e) {
      console.warn('Kunne ikke lese logo for e-post:', e);
    }
  }
  const logoAlt = process.env.MAIL_LOGO_ALT || 'HOLSHIP';
  const logoHtml = logoDataUri
    ? `<img src="${logoDataUri}" alt="${escapeHtml(logoAlt)}" height="${logoMaxHeight}" style="display:block;height:${logoMaxHeight}px;max-height:${logoMaxHeight}px;width:auto;" />`
    : '<span style="font-size:18px;font-weight:600;letter-spacing:.5px;display:block">HOLSHIP RMS</span>';

  const rowsHtml = (opts.rows || []).map(([k,v]) => `
        <tr>
          <td style="padding:6px 10px;font-weight:600;border-bottom:1px solid #e2e8f0;background:#f8fafc;width:160px">${escapeHtml(k)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(v)}</td>
        </tr>`).join('');
  const outroHtml = opts.outro ? escapeHtml(opts.outro).replace(/\n/g, '<br/>') : '';
  return `<!DOCTYPE html>
<html lang="no"><head><meta charSet="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:30px 0;">
    <tr><td align="center">
  <table width="${templateWidth}" style="max-width:${templateWidth}px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.08);border:1px solid #e2e8f0" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:${brandColor};color:#fff;padding:14px 20px;">
            ${logoHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 24px 8px;font-size:18px;font-weight:600;color:${brandColor}">${escapeHtml(opts.title)}</td>
        </tr>
        ${opts.intro ? `<tr><td style=\"padding:0 24px 16px;font-size:14px;line-height:1.5;\">${escapeHtml(opts.intro)}</td></tr>` : ''}
        ${rowsHtml ? `<tr><td style=\"padding:0 24px 8px;\"><table width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;font-size:13px;border-collapse:collapse;\">${rowsHtml}</table></td></tr>` : ''}
  ${outroHtml ? `<tr><td style=\"padding:12px 24px 24px;font-size:13px;line-height:1.5;color:#334155;\">${outroHtml}</td></tr>` : ''}
      </table>
      <div style="font-size:10px;color:#94a3b8;margin-top:12px">© ${new Date().getFullYear()} HOLSHIP</div>
    </td></tr>
  </table>
</body></html>`;
}
