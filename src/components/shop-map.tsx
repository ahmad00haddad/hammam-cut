import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// H&M salon location (from the shared Google Maps link)
export const SHOP = {
  lat: 32.5335604,
  lng: 35.9055309,
  name: "صالون H&M",
  address: "إربد · مع الحلاق همام",
  link: "https://maps.app.goo.gl/P4VqmZrmLaB7mDC7A",
};

type Pos = { lat: number; lng: number };

/** Great-circle distance in km. */
export function distanceKm(a: Pos, b: Pos): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Mode = "driving" | "walking";

/** Rough estimate: road factor 1.3, ~30 km/h by car in town, 5 km/h on foot. */
export function etaMinutes(km: number, mode: Mode): number {
  return Math.max(1, Math.round(((km * 1.3) / (mode === "driving" ? 30 : 5)) * 60));
}

export function fmtEta(min: number): string {
  if (min < 60) return `${min} دقيقة`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} س و${m} د` : `${h} ساعة`;
}

export function directionsUrl(mode: Mode): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${SHOP.lat},${SHOP.lng}&travelmode=${mode}&dir_action=navigate`;
}

export function fmtDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} متر`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} كم`;
}

/** Dark, line-only street map; shows the shop and, when known, the visitor. */
function ShopMap({ user }: { user: Pos | null }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const userMarker = useRef<import("leaflet").Marker | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ default: L }] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
      if (cancelled || !el.current) return;
      leaflet.current = L;
      const map = L.map(el.current, {
        center: [SHOP.lat, SHOP.lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false,
      });
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
        referrerPolicy: "origin",
      }).addTo(map);
      L.marker([SHOP.lat, SHOP.lng], {
        icon: L.divIcon({
          className: "hm-pin",
          html: '<span class="hm-pin-halo"></span><span class="hm-pin-dot"></span>',
          iconSize: [56, 56],
          iconAnchor: [28, 28],
        }),
        interactive: false,
      }).addTo(map);
      setTimeout(() => map.invalidateSize(), 150);
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      userMarker.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const L = leaflet.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !user) return;
    userMarker.current?.remove();
    userMarker.current = L.marker([user.lat, user.lng], {
      icon: L.divIcon({ className: "hm-pin", html: '<span class="hm-me"></span>', iconSize: [20, 20], iconAnchor: [10, 10] }),
      interactive: false,
    }).addTo(map);
    map.fitBounds(L.latLngBounds([user.lat, user.lng], [SHOP.lat, SHOP.lng]), { padding: [50, 50], maxZoom: 17 });
  }, [ready, user]);

  return <div ref={el} className="hm-map absolute inset-0" />;
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/** Corner icon button. Opens the map and asks the visitor for their location to measure the distance. */
export function MapButton() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<Pos | null>(null);
  const [state, setState] = useState<"idle" | "asking" | "denied" | "unsupported" | "ok">("idle");
  const [mode, setMode] = useState<Mode>("driving");

  function locate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("unsupported");
      return;
    }
    setState("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUser({ lat: p.coords.latitude, lng: p.coords.longitude });
        setState("ok");
      },
      () => setState("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (v && state === "idle") locate();
  }

  const km = user ? distanceKm(user, SHOP) : null;
  const here = km !== null && km < 0.15;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          aria-label="موقع الصالون على الخريطة"
          className="absolute end-5 top-6 flex h-11 w-11 items-center justify-center rounded-full border border-primary-foreground/40 bg-black/20 text-primary-foreground transition hover:bg-black/35"
        >
          <MapIcon />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">موقع الصالون</DialogTitle>
        <DialogDescription className="sr-only">خريطة موقع صالون H&M والمسافة والاتجاهات</DialogDescription>

        <div className="relative h-72 bg-card">
          <ShopMap user={user} />
        </div>

        <div className="space-y-4 p-5">
          <div>
            <div className="text-lg font-bold">{SHOP.name}</div>
            <div className="text-sm text-muted-foreground">{SHOP.address}</div>
          </div>

          <div className="rounded-md border bg-background/60 p-4">
            {state === "asking" && <p className="text-sm text-muted-foreground">جارٍ تحديد موقعك…</p>}
            {state === "ok" && km !== null && (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">{here ? "أنت عند الصالون" : "المسافة إليك"}</div>
                  {!here && <div className="text-2xl font-bold text-gold">{fmtDistance(km)}</div>}
                </div>
                {!here && (
                  <div className="text-end">
                    <div className="text-xs text-muted-foreground">الوقت التقريبي</div>
                    <div className="text-lg font-bold">{fmtEta(etaMinutes(km, mode))}</div>
                  </div>
                )}
              </div>
            )}
            {(state === "denied" || state === "unsupported") && (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  {state === "denied" ? "ما قدرنا نحدد موقعك. اسمح للمتصفح بالوصول للموقع لنحسب المسافة." : "المتصفح لا يدعم تحديد الموقع."}
                </p>
                <button className="font-medium underline" onClick={locate}>إعادة المحاولة</button>
              </div>
            )}
            {state === "idle" && (
              <button className="text-sm font-medium underline" onClick={locate}>حدّد موقعي لحساب المسافة</button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {([["driving", "🚗 بالسيارة"], ["walking", "🚶 مشيًا"]] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`h-11 rounded-xl border text-sm font-medium transition ${mode === m ? "border-primary bg-accent" : "bg-card"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <a
            href={directionsUrl(mode)}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 w-full items-center justify-center gap-3 rounded-md bg-primary text-base font-bold text-primary-foreground"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l18-8-8 18-2-8-8-2z" />
            </svg>
            ابدأ الاتجاهات على خرائط جوجل
          </a>
          <a href={SHOP.link} target="_blank" rel="noreferrer" className="block text-center text-xs text-muted-foreground underline">
            فتح صفحة الصالون في خرائط جوجل
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
