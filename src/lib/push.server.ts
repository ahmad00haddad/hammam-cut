// Server-only: send Web Push to all barber devices. Uses WebCrypto (works on Cloudflare Workers).
export async function sendPushToBarber(payload: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}) {
  const raw = process.env["VAPID_PRIVATE_JWK"];
  if (!raw) return;
  let privateJWK: JsonWebKey;
  try {
    privateJWK = JSON.parse(raw);
  } catch {
    console.error("VAPID_PRIVATE_JWK is not valid JSON");
    return;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");
  if (error || !subs?.length) return;
  const { buildPushHTTPRequest } = await import("@pushforge/builder");
  await Promise.all(
    subs.map(async (s) => {
      try {
        const { endpoint, headers, body } = await buildPushHTTPRequest({
          privateJWK,
          subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          message: {
            payload,
            adminContact: "mailto:admin@hammam-cut.lovable.app",
            options: { ttl: 3600, urgency: "high" },
          },
        });
        const res = await fetch(endpoint, { method: "POST", headers, body });
        if (res.status === 404 || res.status === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        } else if (!res.ok) {
          console.error("Push failed", res.status);
        }
      } catch (e) {
        console.error("Push error", e);
      }
    }),
  );
}
