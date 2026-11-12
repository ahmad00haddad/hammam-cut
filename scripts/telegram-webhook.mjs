// One-time setup: points the Telegram bot at the app's webhook.
// Usage (PowerShell):
//   $env:TELEGRAM_BOT_TOKEN="..."; $env:TELEGRAM_WEBHOOK_SECRET="..."; node scripts/telegram-webhook.mjs
// Optional: $env:APP_URL="https://hammam-cut.lovable.app"
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const base = (process.env.APP_URL || "https://hammam-cut.lovable.app").replace(/\/$/, "");

if (!token || !secret) {
  console.error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET first.");
  process.exit(1);
}
if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
  console.error("TELEGRAM_WEBHOOK_SECRET must be 16-256 characters: letters, digits, _ or -.");
  process.exit(1);
}

const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const set = await api("setWebhook", {
  url: `${base}/api/telegram`,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: true,
});
console.log("setWebhook:", JSON.stringify(set));

await api("setMyCommands", {
  commands: [
    { command: "pending", description: "الطلبات المعلّقة" },
    { command: "today", description: "حجوزات اليوم" },
    { command: "status", description: "حالة الحجز" },
    { command: "pause", description: "استراحة بالدقائق، مثال: /pause 30" },
    { command: "resume", description: "إنهاء الاستراحة" },
    { command: "off", description: "إيقاف الحجز" },
    { command: "on", description: "تشغيل الحجز" },
  ],
});

const info = await api("getWebhookInfo", {});
console.log("webhook:", JSON.stringify({ url: info.result?.url, pending: info.result?.pending_update_count, error: info.result?.last_error_message }));
