import { useEffect, useState } from "react";
import { Download, EllipsisVertical, MoreHorizontal, Plus, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

type Platform = "ios" | "android" | "desktop";

export function detectPlatform(): { platform: Platform; iosNotSafari: boolean; installed: boolean } {
  if (typeof navigator === "undefined") return { platform: "android", iosNotSafari: false, installed: false };
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const iosNotSafari = ios && /CriOS|FxiOS|EdgiOS|OPiOS|Instagram|FBAN|FBAV/.test(ua);
  const installed =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return { platform: ios ? "ios" : android ? "android" : "desktop", iosNotSafari, installed };
}

const TABS: { id: Platform; label: string }[] = [
  { id: "ios", label: "آيفون" },
  { id: "android", label: "أندرويد" },
  { id: "desktop", label: "كمبيوتر" },
];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
      <div className="pt-0.5 leading-relaxed">{children}</div>
    </li>
  );
}

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 align-middle text-sm">{children}</span>
);

/** Explains, per device, how to add the app to the home screen (and offers one-tap install where the browser allows it). */
export function InstallDialog({
  open,
  onOpenChange,
  installPrompt,
  onInstalled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  installPrompt: InstallPrompt | null;
  onInstalled: () => void;
}) {
  const [info, setInfo] = useState(() => detectPlatform());
  const [tab, setTab] = useState<Platform>("android");

  useEffect(() => {
    if (!open) return;
    const d = detectPlatform();
    setInfo(d);
    setTab(d.platform);
  }, [open]);

  async function installNow() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      onInstalled();
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto">
        <DialogTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" /> حمّل التطبيق على موبايلك
        </DialogTitle>
        <DialogDescription>بتصير أيقونة H&amp;M على شاشتك، وبتفتح مباشرة زي أي تطبيق، وبدون ما تحمّل من المتجر.</DialogDescription>

        {info.installed ? (
          <p className="rounded-xl bg-card p-4 text-center">التطبيق مثبّت عندك أصلاً. تقدر تفتحه من شاشتك الرئيسية.</p>
        ) : (
          <>
            <div className="flex gap-1 rounded-xl bg-card p-1" role="tablist" aria-label="نوع الجهاز">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`h-10 flex-1 rounded-lg text-sm font-medium transition ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {t.label}
                  {info.platform === t.id && <span className="ms-1 text-[10px] opacity-70">(جهازك)</span>}
                </button>
              ))}
            </div>

            {tab === "android" && installPrompt && (
              <Button variant="gold" size="xl" className="w-full" onClick={installNow}>
                <Download className="h-5 w-5" /> ثبّت التطبيق الآن
              </Button>
            )}

            {tab === "ios" && (
              <div className="space-y-3">
                {info.platform === "ios" && info.iosNotSafari && (
                  <p className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm">
                    لازم تفتح الموقع من متصفح <b>سفاري</b> (Safari)، لأن المتصفحات الثانية على الآيفون ما بتسمح بالتثبيت. انسخ الرابط وافتحه بسفاري.
                  </p>
                )}
                <ol className="space-y-4">
                  <Step n={1}>
                    افتح الموقع بمتصفح <b>سفاري</b>.
                  </Step>
                  <Step n={2}>
                    اضغط زر المشاركة <Chip><Share className="h-4 w-4" /> مشاركة</Chip> اللي بأسفل الشاشة (المربع وفوقه سهم).
                  </Step>
                  <Step n={3}>
                    مرّر لتحت واختر <Chip><SquarePlus className="h-4 w-4" /> إضافة إلى الشاشة الرئيسية</Chip>
                  </Step>
                  <Step n={4}>
                    اضغط <Chip><Plus className="h-4 w-4" /> إضافة</Chip> بأعلى الشاشة. خلصت، لقيت الأيقونة على شاشتك.
                  </Step>
                </ol>
              </div>
            )}

            {tab === "android" && (
              <div className="space-y-3">
                {!installPrompt && <p className="text-sm text-muted-foreground">إذا ما ظهر زر "ثبّت" فوق، اتبع هالخطوات:</p>}
                <ol className="space-y-4">
                  <Step n={1}>
                    افتح الموقع بمتصفح <b>كروم</b> (Chrome).
                  </Step>
                  <Step n={2}>
                    اضغط القائمة <Chip><EllipsisVertical className="h-4 w-4" /> ثلاث نقاط</Chip> بأعلى الشاشة.
                  </Step>
                  <Step n={3}>
                    اختر <Chip>تثبيت التطبيق</Chip> أو <Chip>إضافة إلى الشاشة الرئيسية</Chip>
                  </Step>
                  <Step n={4}>اضغط <b>تثبيت</b>. خلصت، لقيت الأيقونة على شاشتك.</Step>
                </ol>
              </div>
            )}

            {tab === "desktop" && (
              <ol className="space-y-4">
                <Step n={1}>
                  افتح الموقع بمتصفح <b>كروم</b> أو <b>إيدج</b>.
                </Step>
                <Step n={2}>
                  دور على أيقونة التثبيت <Chip><Download className="h-4 w-4" /></Chip> بجانب شريط العنوان، أو افتح القائمة <Chip><MoreHorizontal className="h-4 w-4" /></Chip> واختر <Chip>تثبيت H&amp;M</Chip>
                </Step>
                <Step n={3}>اضغط <b>تثبيت</b>.</Step>
              </ol>
            )}

            <p className="text-xs text-muted-foreground">
              ملاحظة: الموقع بيشتغل عادي من المتصفح حتى لو ما ثبّتّه. التثبيت بس بيسهّل عليك الوصول.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
