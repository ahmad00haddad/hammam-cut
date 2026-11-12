import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { notifyCancel } from "@/lib/telegram.functions";
import { ammanDate, fmtDay, fmtTime } from "@/lib/slots";

export const TOKEN_KEY = "hm_last_token";

type Info = { status: string; start_at: string; party_size: number; reject_reason: string | null };

const LABEL: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مؤكد",
  done: "تمت الحلاقة",
  rejected: "مرفوض",
  cancelled: "ملغى",
  no_show: "لم تحضر",
};

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Shows the visitor's latest booking (by private token) with live status and a cancel button. */
export function MyBookingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const token = open ? readToken() : null;

  useEffect(() => {
    if (!open) return;
    if (!token) {
      setInfo(null);
      return;
    }
    let live = true;
    const load = () =>
      supabase.rpc("get_booking_status", { _token: token }).then(({ data }) => {
        if (live) setInfo((data as unknown as Info | null) ?? null);
      });
    load();
    const t = setInterval(load, 10000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [open, token]);

  async function cancel() {
    if (!token) return;
    await supabase.rpc("cancel_my_booking", { _token: token });
    notifyCancel({ data: { token } }).catch(() => {});
    setInfo((i) => (i ? { ...i, status: "cancelled" } : i));
  }

  const start = info ? new Date(info.start_at) : null;
  const cancellable = info && start && start.getTime() > Date.now() && (info.status === "pending" || info.status === "approved");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>حجزي</DialogTitle>
        <DialogDescription className="sr-only">حالة آخر حجز لك</DialogDescription>
        {info === undefined ? (
          <p className="text-muted-foreground">...</p>
        ) : info === null || !start ? (
          <p className="text-muted-foreground">ما عندك حجز محفوظ على هذا الجهاز.</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-dashed border-foreground/30 p-5 text-center">
              <p className="text-xs text-muted-foreground">{LABEL[info.status] ?? info.status}</p>
              <p className="mt-2 text-4xl font-bold">{fmtTime(start)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {fmtDay(ammanDate(start)).weekday}، {fmtDay(ammanDate(start)).date}
                {info.party_size > 1 ? ` · ${info.party_size} أشخاص` : ""}
              </p>
              {info.status === "rejected" && info.reject_reason && (
                <p className="mt-3 text-sm">{info.reject_reason}</p>
              )}
            </div>
            {cancellable && (
              <Button variant="outline" className="w-full" onClick={cancel}>إلغاء الحجز</Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
