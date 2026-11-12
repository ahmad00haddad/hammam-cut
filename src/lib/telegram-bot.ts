// Telegram bot logic: inline approve/reject buttons and owner commands.
// Pure (no env, no network): callers inject `tg` (Telegram API) and `store` (database).

export type TgButton = { text: string; callback_data?: string; url?: string };
export type TgKeyboard = { inline_keyboard: TgButton[][] };

export type TgUpdate = {
  message?: { chat: { id: number | string }; text?: string };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number | string }; text?: string };
  };
};

export type BookingLine = {
  id: string;
  customer_name: string;
  phone: string | null;
  start_at: string;
  party_size: number;
  status: string;
};

export type BotStatus = {
  enabled: boolean;
  pauseUntil: string | null;
  pending: number;
  todayCount: number;
};

export interface BotStore {
  /** Only a pending booking can be decided. */
  decide(id: string, status: "approved" | "rejected"): Promise<"ok" | "already" | "missing">;
  setEnabled(v: boolean): Promise<void>;
  setPause(minutes: number | null): Promise<string | null>;
  status(): Promise<BotStatus>;
  today(): Promise<BookingLine[]>;
  pending(): Promise<BookingLine[]>;
}

export interface BotApi {
  send(chatId: string, text: string, keyboard?: TgKeyboard): Promise<void>;
  answer(callbackId: string, text: string): Promise<void>;
  edit(chatId: string, messageId: number, text: string): Promise<void>;
}

export function waLink(phone: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "962" + d.slice(1);
  return d.length >= 8 ? `https://wa.me/${d}` : null;
}

export function bookingKeyboard(id: string, phone: string | null): TgKeyboard {
  const rows: TgButton[][] = [
    [
      { text: "✅ موافقة", callback_data: `a:${id}` },
      { text: "❌ رفض", callback_data: `r:${id}` },
    ],
  ];
  const wa = waLink(phone);
  if (wa) rows.push([{ text: "💬 واتساب", url: wa }]);
  return { inline_keyboard: rows };
}

export function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("ar-JO", {
    timeZone: "Asia/Amman",
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-JO", { timeZone: "Asia/Amman", hour: "numeric", minute: "2-digit" });
}

export function parseCommand(text: string | undefined): { cmd: string; arg: string } | null {
  if (!text || !text.startsWith("/")) return null;
  const [first = "", ...rest] = text.trim().split(/\s+/);
  const cmd = first.slice(1).split("@")[0]!.toLowerCase();
  return { cmd, arg: rest.join(" ") };
}

export const HELP = [
  "أوامر همام:",
  "/pending الطلبات المعلّقة",
  "/today حجوزات اليوم",
  "/status حالة الحجز",
  "/pause 30 استراحة بالدقائق",
  "/resume إنهاء الاستراحة",
  "/off إيقاف الحجز",
  "/on تشغيل الحجز",
].join("\n");

const STATUS_AR: Record<string, string> = { pending: "معلّق", approved: "مؤكد", done: "تم" };

function line(b: BookingLine): string {
  const people = b.party_size > 1 ? ` (${b.party_size})` : "";
  return `${fmtHour(b.start_at)} · ${b.customer_name}${people} · ${STATUS_AR[b.status] ?? b.status}`;
}

/** Handles one Telegram update. Only the owner's chat is served; everything else is ignored. */
export async function handleUpdate(update: TgUpdate, ownerChatId: string, api: BotApi, store: BotStore): Promise<void> {
  // inline button presses
  const cb = update.callback_query;
  if (cb) {
    const chat = cb.message?.chat.id;
    if (String(chat) !== ownerChatId) return;
    const [kind, id] = (cb.data ?? "").split(":");
    if ((kind !== "a" && kind !== "r") || !id) {
      await api.answer(cb.id, "أمر غير معروف");
      return;
    }
    const status = kind === "a" ? "approved" : "rejected";
    const res = await store.decide(id, status);
    if (res === "missing") {
      await api.answer(cb.id, "الحجز غير موجود");
      return;
    }
    if (res === "already") {
      await api.answer(cb.id, "تم البت بهذا الطلب مسبقًا");
      return;
    }
    await api.answer(cb.id, status === "approved" ? "تمت الموافقة" : "تم الرفض");
    if (cb.message) {
      const base = cb.message.text ?? "";
      await api.edit(String(chat), cb.message.message_id, `${base}\n\n${status === "approved" ? "✅ تمت الموافقة" : "❌ تم الرفض"}`);
    }
    return;
  }

  // text commands
  const msg = update.message;
  if (!msg || String(msg.chat.id) !== ownerChatId) return;
  const parsed = parseCommand(msg.text);
  if (!parsed) return;
  const chatId = String(msg.chat.id);

  switch (parsed.cmd) {
    case "start":
    case "help":
      await api.send(chatId, HELP);
      return;
    case "on":
      await store.setEnabled(true);
      await api.send(chatId, "تم تشغيل الحجز ✅");
      return;
    case "off":
      await store.setEnabled(false);
      await api.send(chatId, "تم إيقاف الحجز. ما حدا بيقدر يحجز لحد ما ترجع تشغّله بـ /on");
      return;
    case "pause": {
      const n = Number.parseInt(parsed.arg, 10);
      const minutes = Number.isFinite(n) && n > 0 ? Math.min(n, 720) : 30;
      const until = await store.setPause(minutes);
      await api.send(chatId, `استراحة ${minutes} دقيقة${until ? ` لحد ${fmtHour(until)}` : ""} ☕\nبتنهيها بـ /resume`);
      return;
    }
    case "resume":
      await store.setPause(null);
      await api.send(chatId, "انتهت الاستراحة ✅");
      return;
    case "status": {
      const s = await store.status();
      const paused = s.pauseUntil && new Date(s.pauseUntil).getTime() > Date.now();
      await api.send(
        chatId,
        [
          s.enabled ? "الحجز: شغّال ✅" : "الحجز: متوقف ⛔",
          paused ? `استراحة لحد ${fmtHour(s.pauseUntil!)}` : "بدون استراحة",
          `طلبات معلّقة: ${s.pending}`,
          `حجوزات اليوم: ${s.todayCount}`,
        ].join("\n"),
      );
      return;
    }
    case "today": {
      const rows = await store.today();
      await api.send(chatId, rows.length ? `حجوزات اليوم (${rows.length}):\n${rows.map(line).join("\n")}` : "ما في حجوزات اليوم");
      return;
    }
    case "pending": {
      const rows = await store.pending();
      if (!rows.length) {
        await api.send(chatId, "ما في طلبات معلّقة ✅");
        return;
      }
      for (const b of rows.slice(0, 10)) {
        await api.send(
          chatId,
          `💈 طلب حجز\n👤 ${b.customer_name}\n📞 ${b.phone ?? "-"}\n🕒 ${fmtWhen(b.start_at)}${b.party_size > 1 ? `\n👥 ${b.party_size} أشخاص` : ""}`,
          bookingKeyboard(b.id, b.phone),
        );
      }
      return;
    }
    default:
      await api.send(chatId, `ما فهمت الأمر.\n${HELP}`);
  }
}
