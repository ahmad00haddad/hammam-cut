// Shop runs on Amman time (UTC+3, no DST). All hours/durations come from the `settings` row.
export const OFFSET = "+03:00";

export type PublicState = {
  enabled: boolean;
  pause_until: string | null;
  pause_reason: string | null;
  service_minutes: number;
  buffer_minutes: number;
  open_min: number;
  close_min: number;
  days_off: number[];
  window_days: number;
  max_party: number;
  busy: [string, string][];
};

export const DEFAULT_STATE: PublicState = {
  enabled: true,
  pause_until: null,
  pause_reason: null,
  service_minutes: 20,
  buffer_minutes: 5,
  open_min: 720,
  close_min: 1320,
  days_off: [1],
  window_days: 7,
  max_party: 4,
  busy: [],
};

export type Range = { start: number; end: number };

export function busyRanges(s: PublicState): Range[] {
  return s.busy.map(([a, b]) => ({ start: new Date(a).getTime(), end: new Date(b).getTime() }));
}

export function stepMin(s: PublicState): number {
  return s.service_minutes + s.buffer_minutes;
}

export function ammanDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(d);
}

export function ammanMinutes(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Amman",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value);
  const m = Number(parts.find((p) => p.type === "minute")?.value);
  return h * 60 + m;
}

/** ISO weekday 1..7 (Mon..Sun) of an Amman calendar day. */
export function isoWeekday(day: string): number {
  const w = new Date(`${day}T12:00:00${OFFSET}`).getUTCDay();
  return w === 0 ? 7 : w;
}

export function isDayOff(day: string, s: PublicState): boolean {
  return s.days_off.includes(isoWeekday(day));
}

/** Start times of every grid slot in the day (service + buffer apart). */
export function slotsForDay(day: string, s: PublicState): Date[] {
  const out: Date[] = [];
  const step = stepMin(s);
  for (let m = s.open_min; m + s.service_minutes <= s.close_min; m += step) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    out.push(new Date(`${day}T${hh}:${mm}:00${OFFSET}`));
  }
  return out;
}

/** A party of n needs n consecutive steps; the last buffer may run past closing. */
export function slotFits(start: Date, party: number, s: PublicState, busy: Range[]): boolean {
  const t = start.getTime();
  const end = t + stepMin(s) * party * 60000;
  const mins = ammanMinutes(start);
  if (mins + stepMin(s) * party - s.buffer_minutes > s.close_min) return false;
  return !busy.some((r) => t < r.end && end > r.start);
}

export function nextDays(n: number): string[] {
  const res: string[] = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    res.push(ammanDate(new Date(base.getTime() + i * 86400000)));
  }
  return res;
}

export function fmtTime(d: Date): string {
  return new Intl.DateTimeFormat("ar-JO", {
    timeZone: "Asia/Amman",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function fmtDay(day: string): { weekday: string; date: string } {
  const d = new Date(`${day}T12:00:00${OFFSET}`);
  return {
    weekday: new Intl.DateTimeFormat("ar-JO", { timeZone: "Asia/Amman", weekday: "long" }).format(d),
    date: new Intl.DateTimeFormat("ar-JO", { timeZone: "Asia/Amman", day: "numeric", month: "short" }).format(d),
  };
}

export function isOpenNow(s: PublicState): boolean {
  const m = ammanMinutes();
  return s.enabled && !isDayOff(ammanDate(), s) && m >= s.open_min && m < s.close_min;
}

/** Barber is free now if open, not paused, and no booking/block covers this moment. */
export function freeNow(s: PublicState): boolean {
  if (!isOpenNow(s)) return false;
  const now = Date.now();
  return !busyRanges(s).some((r) => now >= r.start - 5 * 60000 && now < r.end);
}

export type Status = "open" | "off" | "paused" | "closed";
export function shopStatus(s: PublicState): Status {
  if (!s.enabled) return "off";
  if (s.pause_until && new Date(s.pause_until).getTime() > Date.now()) return "paused";
  return "open";
}

export function parseLimitError(msg: string): Date | null {
  const m = msg.match(/limit reached (\S+)/);
  if (!m) return null;
  const d = new Date(m[1]!);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DEVICE_KEY = "hm_device_id";
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
