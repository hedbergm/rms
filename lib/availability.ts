import { prisma } from './prisma';
import { startOfDay, setHours, setMinutes, addMinutes, isBefore, isEqual } from 'date-fns';

export type Slot = {
  rampNumber: number;
  start: string; // ISO
  end: string;   // ISO
  status: 'FREE' | 'BOOKED' | 'CLOSED';
  bookingId?: string;
  expired?: boolean; // mindre enn cutoff eller i fortid
  closedReason?: string | null;
};

interface Config { ramps: number[]; slotMinutes: number; windowStart: { h: number; m: number }; windowEnd: { h: number; m: number }; }

export const LOADING_RAMPS = [8,9,10,11];
export const UNLOADING_RAMPS = [3,4,5];
const LOADING_CONFIG: Config = { ramps: LOADING_RAMPS, slotMinutes: 60, windowStart: {h:7,m:0}, windowEnd: {h:17,m:0} }; // Last possible start 16:00
const UNLOADING_CONFIG: Config = { ramps: UNLOADING_RAMPS, slotMinutes: 45, windowStart: {h:7,m:0}, windowEnd: {h:18,m:0} }; // Last possible start 17:15

export async function getAvailability(date: Date, type: 'LOADING' | 'UNLOADING') {
  // Ingen slots i helg
  const day = date.getDay(); // 0 søn, 6 lør
  if (day === 0 || day === 6) return [];
  const cfg = type === 'LOADING' ? LOADING_CONFIG : UNLOADING_CONFIG;
  const dayStart = startOfDay(date);
  const slots: Slot[] = [];
  const windowStart = setMinutes(setHours(dayStart, cfg.windowStart.h), cfg.windowStart.m);
  const windowEnd = setMinutes(setHours(dayStart, cfg.windowEnd.h), cfg.windowEnd.m);

  // Fetch bookings for that day and type
  const bookings = await prisma.booking.findMany({
    where: {
      type,
      start: { gte: windowStart, lt: windowEnd }
    }
  });

  // Fetch closures (ClosedSlot) impacting this day/type
  // @ts-ignore generated after migration
  const closures = await (prisma as any).closedSlot.findMany({
    where: {
      date: dayStart,
      OR: [
        { type: type },
        { type: 'BOTH' }
      ]
    }
  });

  function getClosure(ramp: number, slotStart: Date) {
    if (!closures.length) return null;
    const offset = Math.floor((slotStart.getTime() - dayStart.getTime()) / 60000);
    return closures.find((c: any) => {
      if (c.rampNumber !== null && c.rampNumber !== ramp) return false;
      if (c.startMinute == null) return true; // hele dagen
      const startM = c.startMinute;
      const dur = c.durationMinutes ?? (24*60 - startM);
      const endM = startM + dur;
      return offset >= startM && offset < endM;
    }) || null;
  }

  // Build time grid
  let cursor = windowStart;
  const now = new Date();
  const cutoff = new Date(now.getTime() + 60*60*1000);
  while (isBefore(cursor, windowEnd) || isEqual(cursor, windowEnd)) {
    const end = addMinutes(cursor, cfg.slotMinutes);
    if (end > windowEnd) break;
    for (const ramp of cfg.ramps) {
      const booking = bookings.find(b => b.rampNumber === ramp && b.start.getTime() === cursor.getTime());
      const expired = cursor < cutoff; // ikke tilgjengelig lenger hvis under 1 time
      const closure = getClosure(ramp, cursor);
      slots.push({
        rampNumber: ramp,
        start: cursor.toISOString(),
        end: end.toISOString(),
        status: booking ? 'BOOKED' : (closure ? 'CLOSED' : 'FREE'),
        bookingId: booking?.id,
        expired: (closure ? true : expired),
        closedReason: closure?.reason || null
      });
    }
    cursor = addMinutes(cursor, cfg.slotMinutes);
  }
  return slots;
}

export async function isRampAvailable(rampNumber: number, start: Date, end: Date) {
  const overlap = await prisma.booking.findFirst({
    where: {
      rampNumber,
      start
    }
  });
  return !overlap;
}

export function validateSlot(type: 'LOADING' | 'UNLOADING', rampNumber: number, start: Date) {
  const cfg = type === 'LOADING' ? LOADING_CONFIG : UNLOADING_CONFIG;
  if (!cfg.ramps.includes(rampNumber)) return false;
  const dayStart = startOfDay(start);
  const windowStart = setMinutes(setHours(dayStart, cfg.windowStart.h), cfg.windowStart.m);
  const windowEnd = setMinutes(setHours(dayStart, cfg.windowEnd.h), cfg.windowEnd.m);
  if (start < windowStart || start >= windowEnd) return false;
  return true;
}

export function getDurationMinutes(type: 'LOADING' | 'UNLOADING') {
  return type === 'LOADING' ? LOADING_CONFIG.slotMinutes : UNLOADING_CONFIG.slotMinutes;
}
