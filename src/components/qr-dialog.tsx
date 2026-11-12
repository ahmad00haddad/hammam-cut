import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** QR code of the app link: scan it from another phone to open the booking app. */
export function QrDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.origin : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "صالون H&M", text: "احجز موعدك عند همام", url });
    } catch {
      /* cancelled */
    }
  }

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <DialogTitle>رمز QR للتطبيق</DialogTitle>
        <DialogDescription>امسح الرمز بكاميرا الموبايل لفتح التطبيق، أو شاركه مع أصحابك.</DialogDescription>
        <div className="mx-auto w-fit rounded-2xl bg-[#dddddc] p-4">
          <QRCodeSVG value={url} size={208} bgColor="#dddddc" fgColor="#181818" level="M" />
        </div>
        <p dir="ltr" className="truncate text-xs text-muted-foreground">{url}</p>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11 flex-1" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "تم النسخ" : "نسخ الرابط"}
          </Button>
          {canShare && (
            <Button variant="gold" className="h-11 flex-1" onClick={share}>
              <Share2 className="h-4 w-4" />
              مشاركة
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
