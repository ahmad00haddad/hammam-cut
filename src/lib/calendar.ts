const pad = (n: number) => String(n).padStart(2, "0");

function icsDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

/** Builds a downloadable .ics (calendar) file for a booking. */
export function bookingIcsUrl(start: Date, minutes: number, place: { name: string; lat: number; lng: number }): string {
  const end = new Date(start.getTime() + minutes * 60000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HM Salon//Booking//AR",
    "BEGIN:VEVENT",
    `UID:${start.getTime()}@hm-salon`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:حلاقة - ${place.name}`,
    `LOCATION:${place.name}`,
    `GEO:${place.lat};${place.lng}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:موعد الحلاقة بعد 30 دقيقة",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  return URL.createObjectURL(blob);
}
