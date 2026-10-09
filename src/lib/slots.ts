// Shop runs on Amman time (UTC+3, no DST).
export const OPEN_MIN = 12 * 60;
export const CLOSE_MIN = 22 * 60;
export const SLOT_MIN = 20;
export const OFFSET = "+03:00";

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

export function isMonday(day: string): boolean {
  return new Date(`${day}T12:00:00${OFFSET}`).getUTCDay() === 1;
}

export function slotsForDay(day: string): Date[] {
  const out: Date[] = [];
  for (let m = OPEN_MIN; m + SLOT_MIN <= CLOSE_MIN; m += SLOT_MIN) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    out.push(new Date(`${day}T${hh}:${mm}:00${OFFSET}`));
  }
  return out;
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

export function isOpenNow(): boolean {
  const today = ammanDate();
  const m = ammanMinutes();
  return !isMonday(today) && m >= OPEN_MIN && m < CLOSE_MIN;
}

/** Barber is free now if open and no active booking covers the current 20-min window. */
export function freeNow(taken: Date[]): boolean {
  if (!isOpenNow()) return false;
  const now = Date.now();
  return !taken.some((t) => {
    const s = t.getTime();
    return now >= s - 5 * 60000 && now < s + SLOT_MIN * 60000;
  });
}
