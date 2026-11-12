import { createFileRoute } from "@tanstack/react-router";
import { handleUpdate, type BookingLine, type BotApi, type BotStore, type TgKeyboard, type TgUpdate } from "@/lib/telegram-bot";

function makeApi(token: string): BotApi {
  const call = async (method: string, body: Record<string, unknown>) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error(`Telegram ${method} failed`, res.status, await res.text());
  };
  return {
    send: (chatId: string, text: string, keyboard?: TgKeyboard) =>
      call("sendMessage", { chat_id: chatId, text, ...(keyboard ? { reply_markup: keyboard } : {}) }),
    answer: (callbackId: string, text: string) => call("answerCallbackQuery", { callback_query_id: callbackId, text }),
    edit: (chatId: string, messageId: number, text: string) =>
      call("editMessageText", { chat_id: chatId, message_id: messageId, text, reply_markup: { inline_keyboard: [] } }),
  };
}

async function makeStore(): Promise<BotStore> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const COLS = "id, customer_name, phone, start_at, party_size, status";

  const todayRange = () => {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman" }).format(new Date());
    return {
      start: new Date(`${day}T00:00:00+03:00`).toISOString(),
      end: new Date(`${day}T23:59:59+03:00`).toISOString(),
    };
  };

  const todayRows = async (): Promise<BookingLine[]> => {
    const r = todayRange();
    const { data } = await db
      .from("bookings")
      .select(COLS)
      .gte("start_at", r.start)
      .lte("start_at", r.end)
      .in("status", ["pending", "approved", "done"])
      .order("start_at");
    return (data ?? []) as BookingLine[];
  };

  return {
    async decide(id, status) {
      const { data } = await db
        .from("bookings")
        .update({ status, decided_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (data && data.length > 0) return "ok";
      const { data: exists } = await db.from("bookings").select("id").eq("id", id).maybeSingle();
      return exists ? "already" : "missing";
    },
    async setEnabled(v) {
      await db.from("settings").update({ booking_enabled: v, updated_at: new Date().toISOString() }).eq("id", 1);
    },
    async setPause(minutes) {
      const until = minutes ? new Date(Date.now() + minutes * 60000).toISOString() : null;
      await db
        .from("settings")
        .update({ pause_until: until, pause_reason: null, updated_at: new Date().toISOString() })
        .eq("id", 1);
      return until;
    },
    async status() {
      const [{ data: s }, { count }, rows] = await Promise.all([
        db.from("settings").select("booking_enabled, pause_until").eq("id", 1).maybeSingle(),
        db.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
        todayRows(),
      ]);
      return {
        enabled: s?.booking_enabled ?? true,
        pauseUntil: s?.pause_until ?? null,
        pending: count ?? 0,
        todayCount: rows.length,
      };
    },
    today: todayRows,
    async pending() {
      const { data } = await db.from("bookings").select(COLS).eq("status", "pending").order("start_at").limit(10);
      return (data ?? []) as BookingLine[];
    },
  };
}

async function secretMatches(provided: string | null, expected: string): Promise<boolean> {
  if (!provided) return false;
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

export const Route = createFileRoute("/api/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["TELEGRAM_BOT_TOKEN"];
        const chatId = process.env["TELEGRAM_CHAT_ID"];
        const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
        if (!token || !chatId || !secret) return new Response("Server configuration error", { status: 500 });

        if (!(await secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), secret))) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: TgUpdate;
        try {
          update = (await request.json()) as TgUpdate;
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        try {
          await handleUpdate(update, String(chatId), makeApi(token), await makeStore());
        } catch (e) {
          // always answer 200 so Telegram does not retry the same update forever
          console.error("telegram webhook error", e);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
