import { useEffect, useRef } from "react";

// H&M salon location (from the shared Google Maps link)
export const SHOP = {
  lat: 32.5335604,
  lng: 35.9055309,
  name: "صالون H&M",
  address: "إربد · مع الحلاق همام",
  link: "https://maps.app.goo.gl/P4VqmZrmLaB7mDC7A",
};

/** Dark, line-only street map with a single marker, like a boutique-app location card. */
export function ShopMap() {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const [{ default: L }] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
      if (cancelled || !el.current) return;
      map = L.map(el.current, {
        center: [SHOP.lat, SHOP.lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false,
        dragging: true,
        touchZoom: true,
      });
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
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return (
    <div className="relative h-80 overflow-hidden rounded-3xl border bg-card">
      <div ref={el} className="hm-map absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-background via-background/85 to-transparent p-5 pt-16">
        <div>
          <div className="text-lg font-bold">{SHOP.name}</div>
          <div className="text-sm text-muted-foreground">{SHOP.address}</div>
        </div>
        <a
          href={SHOP.link}
          target="_blank"
          rel="noreferrer"
          aria-label="افتح الموقع في خرائط جوجل"
          className="pointer-events-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold text-primary-foreground shadow-glow"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l18-8-8 18-2-8-8-2z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
