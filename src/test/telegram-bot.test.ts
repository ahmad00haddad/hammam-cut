import { describe, expect, it } from "vitest";
import { bookingKeyboard, handleUpdate, parseCommand, waLink, type BotApi, type BotStore } from "@/lib/telegram-bot";

const OWNER = "111";

function fakes() {
  const sent: { text: string; kb?: unknown }[] = [];
  const answered: string[] = [];
  const edited: string[] = [];
  const calls: string[] = [];
  const api: BotApi = {
    send: async (_c, text, kb) => void sent.push({ text, kb }),
    answer: async (_id, text) => void answered.push(text),
    edit: async (_c, _m, text) => void edited.push(text),
  };
  const decided = new Map<string, string>();
  const store: BotStore = {
    decide: async (id, status) => {
      if (id === "missing") return "missing";
      if (decided.has(id)) return "already";
      decided.set(id, status);
      return "ok";
    },
    setEnabled: async (v) => void calls.push(`enabled:${v}`),
    setPause: async (m) => {
      calls.push(`pause:${m}`);
      return m ? new Date(Date.now() + m * 60000).toISOString() : null;
    },
    status: async () => ({ enabled: true, pauseUntil: null, pending: 2, todayCount: 5 }),
    today: async () => [{ id: "1", customer_name: "علي", phone: null, start_at: new Date().toISOString(), party_size: 2, status: "approved" }],
    pending: async () => [{ id: "p1", customer_name: "سامر", phone: "0791234567", start_at: new Date().toISOString(), party_size: 1, status: "pending" }],
  };
  return { api, store, sent, answered, edited, calls };
}

const cb = (data: string, chat = OWNER) => ({
  callback_query: { id: "cb1", data, message: { message_id: 7, chat: { id: chat }, text: "💈 حجز جديد" } },
});
const msg = (text: string, chat = OWNER) => ({ message: { chat: { id: chat }, text } });

describe("telegram helpers", () => {
  it("builds approve/reject buttons and a whatsapp link", () => {
    const kb = bookingKeyboard("abc", "0791234567");
    expect(kb.inline_keyboard[0]!.map((b) => b.callback_data)).toEqual(["a:abc", "r:abc"]);
    expect(kb.inline_keyboard[1]![0]!.url).toBe("https://wa.me/962791234567");
    expect(bookingKeyboard("abc", null).inline_keyboard).toHaveLength(1);
    expect(waLink("123")).toBeNull();
  });
  it("parses commands", () => {
    expect(parseCommand("/pause@HmBot 45")).toEqual({ cmd: "pause", arg: "45" });
    expect(parseCommand("hello")).toBeNull();
  });
});

describe("handleUpdate", () => {
  it("approves a pending booking from the button and edits the message", async () => {
    const f = fakes();
    await handleUpdate(cb("a:b1"), OWNER, f.api, f.store);
    expect(f.answered).toEqual(["تمت الموافقة"]);
    expect(f.edited[0]).toContain("✅ تمت الموافقة");
  });
  it("rejects, and ignores a second press", async () => {
    const f = fakes();
    await handleUpdate(cb("r:b2"), OWNER, f.api, f.store);
    await handleUpdate(cb("a:b2"), OWNER, f.api, f.store);
    expect(f.answered).toEqual(["تم الرفض", "تم البت بهذا الطلب مسبقًا"]);
    expect(f.edited).toHaveLength(1);
  });
  it("ignores anyone who is not the owner", async () => {
    const f = fakes();
    await handleUpdate(cb("a:b3", "999"), OWNER, f.api, f.store);
    await handleUpdate(msg("/off", "999"), OWNER, f.api, f.store);
    expect(f.answered).toHaveLength(0);
    expect(f.sent).toHaveLength(0);
    expect(f.calls).toHaveLength(0);
  });
  it("runs pause / resume / on / off", async () => {
    const f = fakes();
    await handleUpdate(msg("/pause 45"), OWNER, f.api, f.store);
    await handleUpdate(msg("/pause"), OWNER, f.api, f.store);
    await handleUpdate(msg("/pause 99999"), OWNER, f.api, f.store);
    await handleUpdate(msg("/resume"), OWNER, f.api, f.store);
    await handleUpdate(msg("/off"), OWNER, f.api, f.store);
    await handleUpdate(msg("/on"), OWNER, f.api, f.store);
    expect(f.calls).toEqual(["pause:45", "pause:30", "pause:720", "pause:null", "enabled:false", "enabled:true"]);
  });
  it("lists pending bookings with buttons", async () => {
    const f = fakes();
    await handleUpdate(msg("/pending"), OWNER, f.api, f.store);
    expect(f.sent[0]!.text).toContain("سامر");
    expect(f.sent[0]!.kb).toBeTruthy();
  });
  it("answers /today and /status", async () => {
    const f = fakes();
    await handleUpdate(msg("/today"), OWNER, f.api, f.store);
    await handleUpdate(msg("/status"), OWNER, f.api, f.store);
    expect(f.sent[0]!.text).toContain("علي");
    expect(f.sent[1]!.text).toContain("طلبات معلّقة: 2");
  });
});
