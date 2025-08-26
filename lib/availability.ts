import { prisma } from './prisma';
import { addMinutes, isBefore, startOfDay, setHours, setMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'Europe/Oslo';

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

// Oppdatert: fjernet laste rampe 11 og losse rampe 5
export const LOADING_RAMPS = [8,9,10];
export const UNLOADING_RAMPS = [3,4];
const LOADING_CONFIG: Config = { ramps: LOADING_RAMPS, slotMinutes: 60, windowStart: {h:8,m:0}, windowEnd: {h:17,m:0} }; // Last possible start 16:00
const UNLOADING_CONFIG: Config = { ramps: UNLOADING_RAMPS, slotMinutes: 45, windowStart: {h:8,m:0}, windowEnd: {h:18,m:0} }; // Last possible start 17:15

export async function getAvailability(date: Date, type: 'LOADING' | 'UNLOADING') {
  // Ingen slots i helg
  const day = date.getDay(); // 0 søn, 6 lør
  if (day === 0 || day === 6) return [];
  const cfg = type === 'LOADING' ? LOADING_CONFIG : UNLOADING_CONFIG;
  // Convert input date to Norwegian time zone
  const osloDate = new Date(formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd'));
  
  // Set up window start/end times in Norwegian time
  const windowStart = new Date(osloDate);
  windowStart.setHours(cfg.windowStart.h, cfg.windowStart.m, 0, 0);
  
  const windowEnd = new Date(osloDate);
  windowEnd.setHours(cfg.windowEnd.h, cfg.windowEnd.m, 0, 0);
  
  // Debug info
  console.log('Oslo date:', formatInTimeZone(osloDate, TIMEZONE, 'yyyy-MM-dd HH:mm:ss'));
  console.log('Window start (Oslo):', formatInTimeZone(windowStart, TIMEZONE, 'yyyy-MM-dd HH:mm:ss'));
  console.log('Window end (Oslo):', formatInTimeZone(windowEnd, TIMEZONE, 'yyyy-MM-dd HH:mm:ss'));
  
  const slots: Slot[] = [];

  // Fetch bookings for that day and type
  const bookings = await prisma.booking.findMany({
    where: {
      type,
      start: { gte: windowStart, lt: windowEnd }
    }
  });

  // Fetch closures (ClosedSlot) impacting this day/type (tolerate if model not migrated yet)
  let closures: any[] = [];
  try {
    const client: any = prisma as any;
    if (client.closedSlot) {
      closures = await client.closedSlot.findMany({
        where: {
          date: osloDate,
          OR: [
            { type: type },
            { type: 'BOTH' }
          ]
        }
      });
    }
  } catch (e) {
    // ignore – treat as no closures
  }

  function getClosure(ramp: number, slotStart: Date) {
    if (!closures.length) return null;
    // Calculate minutes since start of day in Oslo time
    const osloTime = formatInTimeZone(slotStart, TIMEZONE, 'HH:mm');
    const [hours, minutes] = osloTime.split(':').map(Number);
    const offset = hours * 60 + minutes;
    
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
  // Viktig: ikke inkludere windowEnd selv ellers kan cursor låse seg ved break
  while (isBefore(cursor, windowEnd)) {
    const end = addMinutes(cursor, cfg.slotMinutes);
    if (end > windowEnd) break; // siste slot får ikke starte dersom den ender utenfor vindu
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
