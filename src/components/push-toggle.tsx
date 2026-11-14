import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

// Public VAPID key (safe to expose). The private key lives in the VAPID_PRIVATE_JWK secret.
const VAPID_PUBLIC_KEY =
  "BNSUrzMTQ1JKB0JW7nY8ZveeooYrepArti-bz3zwVJv5sAfPmk9Hrmtc4EvYaf0WukQJxKNSo8j9Cd0NJTGcqxw";

function b64ToBytes(s: string) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushToggle() {
  const [supported, setSupported] = useState(true);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setOn(!!sub && Notification.permission === "granted"))
      .catch(() => {});
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("لم يتم السماح بالإشعارات");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY),
        }));
      const j = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({
        endpoint: sub.endpoint,
        p256dh: j.keys?.["p256dh"] ?? "",
        auth: j.keys?.["auth"] ?? "",
      });
      if (error) throw error;
      setOn(true);
      toast.success("تم تفعيل الإشعارات على هذا الجهاز");
    } catch {
      toast.error("تعذّر تفعيل الإشعارات");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setOn(false);
    } finally {
      setBusy(false);
    }
  }

  if (!supported)
    return (
      <p className="text-xs text-muted-foreground">
        الإشعارات غير مدعومة هنا. على الآيفون أضف التطبيق للشاشة الرئيسية أولاً.
      </p>
    );
  return (
    <Button
      variant={on ? "outline" : "default"}
      size="sm"
      disabled={busy}
      onClick={on ? disable : enable}
    >
      {on ? <BellOff className="ms-1 h-4 w-4" /> : <Bell className="ms-1 h-4 w-4" />}
      {on ? "إيقاف إشعارات الجهاز" : "تفعيل إشعارات الجهاز"}
    </Button>
  );
}
