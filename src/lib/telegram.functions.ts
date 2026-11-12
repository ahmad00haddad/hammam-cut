import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const notifyBooking = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const token = process.env["TELEGRAM_BOT_TOKEN"];
    const chatId = process.env["TELEGRAM_CHAT_ID"];
    if (!token || !chatId) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: b } = await supabaseAdmin
      .from("bookings")
      .select("customer_name, phone, start_at, created_at, walk_in")
      .eq("id", data.id)
      .maybeSingle();
    // Only notify for fresh online bookings (prevents replaying old ids)
    if (!b || b.walk_in || Date.now() - new Date(b.created_at).getTime() > 120000) return { ok: false };
    const when = new Date(b.start_at).toLocaleString("ar-JO", {
      timeZone: "Asia/Amman", weekday: "long", day: "numeric", month: "numeric", hour: "numeric", minute: "2-digit",
    });
    const text = `💈 حجز جديد\n👤 ${b.customer_name}\n📞 ${b.phone ?? "-"}\n🕒 ${when}`;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) console.error("Telegram send failed", res.status, await res.text());
    return { ok: res.ok };
  });
