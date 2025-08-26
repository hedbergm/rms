import { prisma } from './prisma';
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
  
  // Get date components in Oslo time
  const osloDateStr = formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
  console.log('Oslo date string:', osloDateStr);
  
  // Generate slots array
  const slots: Slot[] = [];
  const slotMinutes = cfg.slotMinutes;
  const now = new Date();
  const cutoff = new Date(now.getTime() + 60*60*1000);
  
  // Fetch bookings and closures first
  const bookings = await prisma.booking.findMany({
    where: {
      type,
      start: {
        gte: new Date(osloDateStr + 'T00:00:00'),
        lt: new Date(osloDateStr + 'T23:59:59')
      }
    }
  });

  let closures: any[] = [];
  try {
    const client: any = prisma as any;
    if (client.closedSlot) {
      closures = await client.closedSlot.findMany({
        where: {
          date: new Date(osloDateStr),
          OR: [
            { type: type },
            { type: 'BOTH' }
          ]
        }
      });
    }
  } catch (e) {
    // ignore
  }
  
  // Generate slots with exact times
  for (let hour = cfg.windowStart.h; hour < cfg.windowEnd.h; hour++) {
    for (let minute = 0; minute < 60; minute += slotMinutes) {
      // Skip if this would go past the end time
      if (hour === cfg.windowEnd.h - 1 && minute + slotMinutes > cfg.windowEnd.m) continue;
      
      // Create dates in Oslo timezone
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      console.log('Creating slot for time:', timeStr);
      
      const slotStart = new Date(`${osloDateStr}T${timeStr}:00`);
      const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60000);
      
      for (const ramp of cfg.ramps) {
        const booking = bookings.find(b => 
          b.rampNumber === ramp && 
          b.start.toISOString() === slotStart.toISOString()
        );
        
        // Check for closure
        const minutesSinceMidnight = hour * 60 + minute;
        const closure = closures.find(c => {
          if (c.rampNumber !== null && c.rampNumber !== ramp) return false;
          if (c.startMinute == null) return true; // hele dagen
          const startM = c.startMinute;
          const dur = c.durationMinutes ?? (24*60 - startM);
          return minutesSinceMidnight >= startM && minutesSinceMidnight < (startM + dur);
        });
        
        const expired = slotStart < cutoff;
        
        slots.push({
          rampNumber: ramp,
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          status: booking ? 'BOOKED' : (closure ? 'CLOSED' : 'FREE'),
          bookingId: booking?.id,
          expired: (closure ? true : expired),
          closedReason: closure?.reason || null
        });
      }
    }
  }

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

export async function isRampAvailable(rampNumber: number, start: Date) {
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
  
  // Convert date to Oslo time for validation
  const timeStr = formatInTimeZone(start, TIMEZONE, 'HH:mm');
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Check if time is within window
  if (hours < cfg.windowStart.h || hours >= cfg.windowEnd.h) return false;
  if (hours === cfg.windowStart.h && minutes < cfg.windowStart.m) return false;
  if (hours === cfg.windowEnd.h - 1 && minutes >= cfg.windowEnd.m) return false;
  
  return true;
}

export function getDurationMinutes(type: 'LOADING' | 'UNLOADING') {
  return type === 'LOADING' ? LOADING_CONFIG.slotMinutes : UNLOADING_CONFIG.slotMinutes;
}
