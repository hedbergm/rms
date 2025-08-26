import { prisma } from "./prisma";
import { formatInTimeZone } from "date-fns-tz";

const TIMEZONE = "Europe/Oslo";

export type Slot = {
  rampNumber: number;
  start: string; // ISO
  end: string;   // ISO
  status: "FREE" | "BOOKED" | "CLOSED";
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

export async function getAvailability(date: Date, bookingType: "LOADING" | "UNLOADING") {
  // Convert input date to Oslo timezone at midnight
  const osloMidnight = formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd'T'00:00:00.000xxx");
  const osloDate = new Date(osloMidnight);
  
  // Ingen slots i helg
  const day = osloDate.getDay(); // 0 søn, 6 lør
  if (day === 0 || day === 6) return [];
  
  const cfg = bookingType === "LOADING" ? LOADING_CONFIG : UNLOADING_CONFIG;
  
  // Get current time in Oslo with 1 hour buffer
  const now = new Date();
  const todayOslo = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
  const currentHourOslo = formatInTimeZone(now, TIMEZONE, "HH");
  const currentMinuteOslo = formatInTimeZone(now, TIMEZONE, "mm");
  
  // For slots today, mark as expired if less than 1 hour from now
  const isToday = osloDate.getTime() === new Date(todayOslo).getTime();
  const currentMinutesSinceMidnight = isToday ? (parseInt(currentHourOslo) * 60 + parseInt(currentMinuteOslo)) : -1;
  
  // Fetch bookings and closures first
  const existingBookings = await prisma.booking.findMany({
    where: {
      type: bookingType,
      start: {
        gte: osloDate,
        lt: new Date(osloDate.getTime() + 24*60*60*1000)
      }
    }
  });

  let slotClosures: any[] = [];
  try {
    const client: any = prisma as any;
    if (client.closedSlot) {
      slotClosures = await client.closedSlot.findMany({
        where: {
          date: osloDate,
          OR: [
            { type: bookingType },
            { type: "BOTH" }
          ]
        }
      });
    }
  } catch (e) {
    // ignore
  }
  
  // Generate slots array
  const slots: Slot[] = [];
  const slotMinutes = cfg.slotMinutes;
  
  // Generate slots with exact times
  for (let hour = cfg.windowStart.h; hour < cfg.windowEnd.h; hour++) {
    for (let minute = 0; minute < 60; minute += slotMinutes) {
      // Skip if this would go past the end time
      if (hour === cfg.windowEnd.h - 1 && minute + slotMinutes > cfg.windowEnd.m) continue;
      
      // Create slot time in Oslo timezone
      const slotTime = new Date(osloDate);
      slotTime.setHours(hour, minute, 0, 0);
      
      const slotStart = slotTime;
      const slotEnd = new Date(slotTime.getTime() + slotMinutes * 60000);
      
      // Format for debugging
      const timeStr = formatInTimeZone(slotTime, TIMEZONE, "HH:mm");
      console.log("Creating slot for time:", timeStr);
      
      for (const ramp of cfg.ramps) {
        const booking = existingBookings.find(b => 
          b.rampNumber === ramp && 
          b.start.toISOString() === slotStart.toISOString()
        );
        
        // Check for closure
        const minutesSinceMidnight = hour * 60 + minute;
        const closure = slotClosures.find(c => {
          if (c.rampNumber !== null && c.rampNumber !== ramp) return false;
          if (c.startMinute == null) return true; // hele dagen
          const startM = c.startMinute;
          const dur = c.durationMinutes ?? (24*60 - startM);
          return minutesSinceMidnight >= startM && minutesSinceMidnight < (startM + dur);
        });
        
        const slotMinutesSinceMidnight = hour * 60 + minute;
        const expired = isToday && slotMinutesSinceMidnight <= (currentMinutesSinceMidnight + 60);
        
        slots.push({
          rampNumber: ramp,
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          status: booking ? "BOOKED" : (closure ? "CLOSED" : "FREE"),
          bookingId: booking?.id,
          expired: (closure ? true : expired),
          closedReason: closure?.reason || null
        });
      }
    }
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

export function validateSlot(type: "LOADING" | "UNLOADING", rampNumber: number, start: Date) {
  const cfg = type === "LOADING" ? LOADING_CONFIG : UNLOADING_CONFIG;
  if (!cfg.ramps.includes(rampNumber)) return false;
  
  // Convert date to Oslo time for validation
  const timeStr = formatInTimeZone(start, TIMEZONE, "HH:mm");
  const [hours, minutes] = timeStr.split(":").map(Number);
  
  // Check if time is within window
  if (hours < cfg.windowStart.h || hours >= cfg.windowEnd.h) return false;
  if (hours === cfg.windowStart.h && minutes < cfg.windowStart.m) return false;
  if (hours === cfg.windowEnd.h - 1 && minutes >= cfg.windowEnd.m) return false;
  
  return true;
}

export function getDurationMinutes(type: "LOADING" | "UNLOADING") {
  return type === "LOADING" ? LOADING_CONFIG.slotMinutes : UNLOADING_CONFIG.slotMinutes;
}
