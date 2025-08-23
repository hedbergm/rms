import nodemailer from 'nodemailer';
import { format } from 'date-fns';

const host = process.env.O365_HOST || 'smtp.office365.com';
const port = parseInt(process.env.O365_PORT || '587', 10);
const secure = process.env.O365_SECURE === 'true';
const user = process.env.O365_USER;
const pass = process.env.O365_PASS;
const from = process.env.MAIL_FROM || user || 'no-reply@example.com';
const bcc = process.env.MAIL_BCC; // valgfri kopi for interne varsler

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: user && pass ? { user, pass } : undefined,
});

export async function sendUserCreatedEmail(to: string, password: string) {
  if (!user || !pass) {
    console.warn('SMTP not configured; skipping email.');
    return;
  }
  await transporter.sendMail({
    from,
    to,
    subject: 'Tilgang til HOLSHIP RMS',
    text: `Du har fått tilgang til HOLSHIP RAMPE Management System.\nBruker: ${to}\nPassord: ${password}\nLogg inn og endre passord snarest.`,
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
  if (!user || !pass) {
    console.warn('SMTP ikke konfigurert; hopper over booking-epost.');
    return;
  }
  const startStr = format(booking.start, 'yyyy-MM-dd HH:mm');
  const endStr = format(booking.end, 'HH:mm');
  const subject = `Booking bekreftelse HOLSHIP – ${booking.type === 'LOADING' ? 'Lasting' : 'Lossing'} Rampe ${booking.rampNumber} ${startStr}`;
  const lines = [
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
    'Vennligst møt opp i god tid før slot starter.',
    'Ta kontakt med HOLSHIP dersom endringer er nødvendig.'
  ];
  await transporter.sendMail({
    from,
    to: booking.email,
    bcc: bcc || undefined,
    subject,
  text: lines.filter(Boolean).join('\n')
  });
}
