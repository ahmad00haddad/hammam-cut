import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Archive, BarChart3, CalendarDays, Inbox, Settings, Zap, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { csvRow } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { RazorMark } from "@/components/razor-mark";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_STATE,
  type PublicState,
  OFFSET,
  ammanDate,
  busyRanges,
  fmtDay,
  fmtTime,
  nextDays,
  slotFits,
  slotsForDay,
  stepMin,
} from "@/lib/slots";

export type Booking = {
  id: string;
  customer_name: string;
  phone: string | null;
  start_at: string;
  end_at: string;
  status: string;
  walk_in: boolean;
  party_size: number;
  party_names: string[] | null;
  reject_reason: string | null;
  admin_note: string | null;
  created_at: string;
};

type Settings = {
  booking_enabled: boolean;
  pause_until: string | null;
  pause_reason: string | null;
  service_minutes: number;
  buffer_minutes: number;
  open_min: number;
  close_min: number;
  days_off: number[];
  booking_window_days: number;
  max_party_size: number;
  max_bookings_per_device_24h: number;
  auto_approve: boolean;
  min_notice_minutes: number;
};

type Block = { id: string; start_at: string; end_at: string; reason: string | null };
type Blocked = { id: string; kind: string; value: string; reason: string | null };

const STATUS_AR: Record<string, string> = {
  pending: "معلّق",
  approved: "مؤكد",
  done: "تم",
  rejected: "مرفوض",
  cancelled: "ملغى",
  no_show: "لم يحضر",
};

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.3, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* ignore */
  }
}

function waLink(phone: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "962" + d.slice(1);
  return `https://wa.me/${d}`;
}

function minToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function hhmmToMin(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

type Tab = "now" | "requests" | "schedule" | "archive" | "stats" | "settings";

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("now");
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(async () => {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setPending(count ?? 0);
  }, []);

  useEffect(() => {
    refreshPending();
    const ch = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, (p) => {
        if (p.eventType === "INSERT") {
          const b = p.new as Booking;
          if (!b.walk_in) {
            beep();
            toast.success(`حجز جديد: ${b.customer_name}${b.party_size > 1 ? ` (${b.party_size})` : ""} — ${fmtTime(new Date(b.start_at))}`, { duration: 10000 });
          }
        }
        refreshPending();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refreshPending]);

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "now", label: "الآن", icon: Zap },
    { id: "requests", label: "الطلبات", icon: Inbox },
    { id: "schedule", label: "الجدول", icon: CalendarDays },
    { id: "archive", label: "الأرشيف", icon: Archive },
    { id: "stats", label: "إحصائيات", icon: BarChart3 },
    { id: "settings", label: "الإعدادات", icon: Settings },
  ];

  return (
    <main className="mx-auto max-w-lg px-5 pb-32 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gold">أهلاً همام</h1>
          <p className="text-sm text-muted-foreground">لوحة التحكم</p>
        </div>
        <RazorMark className="h-5 w-auto shrink-0 text-foreground/60" />
        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>خروج</Button>
      </header>

      <div className="mt-6">
        {tab === "now" && <NowTab />}
        {tab === "requests" && <RequestsTab onChange={refreshPending} />}
        {tab === "schedule" && <ScheduleTab />}
        {tab === "archive" && <ArchiveTab />}
        {tab === "stats" && <StatsTab />}
        {tab === "settings" && <SettingsTab />}
      </div>

      <nav
        aria-label="التنقل"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#181818]/95 p-2 shadow-2xl shadow-black/60 backdrop-blur">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            const special = t.id === "requests";
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
                title={t.label}
                className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 active:scale-95 ${
                  active
                    ? "bg-[#dddddc] text-[#181818]"
                    : special
                      ? "bg-primary text-primary-foreground"
                      : "text-[#dddddc]/75 hover:text-[#dddddc]"
                }`}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={1.7} />
                {special && pending > 0 && (
                  <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                    {pending}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

/* ───────────── shared hooks ───────────── */

function useSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    if (data) setS(data as unknown as Settings);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase
      .channel("settings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);
  const save = useCallback(
    async (patch: Partial<Settings>) => {
      const { error } = await supabase.from("settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) toast.error("تعذر الحفظ");
      await load();
      return !error;
    },
    [load],
  );
  return { s, save };
}

function useTick(ms = 30000) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
  return t;
}

async function patchBooking(id: string, patch: TablesUpdate<"bookings">) {
  const { error } = await supabase.from("bookings").update(patch).eq("id", id);
  if (error) toast.error("تعذر التحديث");
}

/* ───────────── NOW ───────────── */

function NowTab() {
  const { s, save } = useSettings();
  useTick(15000);
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const [next, setNext] = useState<Booking[]>([]);
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [showQr, setShowQr] = useState(false);

  const loadNext = useCallback(async () => {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("status", "approved")
      .gte("end_at", new Date().toISOString())
      .order("start_at")
      .limit(3);
    setNext((data as unknown as Booking[]) ?? []);
  }, []);
  useEffect(() => {
    loadNext();
    const ch = supabase.channel("now-live").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, loadNext).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [loadNext]);

  if (!s) return <p className="text-center text-muted-foreground">...</p>;

  const pausedUntil = s.pause_until && new Date(s.pause_until).getTime() > Date.now() ? new Date(s.pause_until) : null;
  const left = pausedUntil ? Math.max(0, Math.ceil((pausedUntil.getTime() - Date.now()) / 60000)) : 0;

  async function pause(minutes: number) {
    const until = new Date(Date.now() + minutes * 60000).toISOString();
    if (await save({ pause_until: until, pause_reason: reason.trim() || null })) toast.success(`استراحة ${minutes} دقيقة`);
  }

  async function addWalkIn() {
    if (walkName.trim().length < 2) { toast.error("اكتب اسم الزبون"); return; }
    const today = ammanDate();
    const { data } = await supabase.rpc("get_public_state", { _day: today });
    const st = { ...DEFAULT_STATE, ...(data as unknown as PublicState) };
    const ranges = busyRanges(st).filter((r) => r.start !== r.end);
    // walk-in ignores the pause window but respects bookings/blocks
    const real = ranges.filter((r) => !(st.pause_until && r.end === new Date(st.pause_until).getTime()));
    const now = Date.now();
    const slot = slotsForDay(today, st).find((x) => x.getTime() + st.service_minutes * 60000 > now && slotFits(x, 1, st, real));
    if (!slot) { toast.error("لا يوجد وقت فارغ اليوم"); return; }
    const { error } = await supabase.from("bookings").insert({
      customer_name: walkName.trim(),
      phone: walkPhone.trim() || null,
      start_at: slot.toISOString(),
      end_at: new Date(slot.getTime() + stepMin(st) * 60000).toISOString(),
      walk_in: true,
      status: "approved",
    });
    if (error) { toast.error("تعذر الإضافة"); return; }
    toast.success(`تمت إضافة ${walkName} الساعة ${fmtTime(slot)}`);
    setWalkName("");
    setWalkPhone("");
    loadNext();
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-5">
      <section className={`flex items-center justify-between rounded-2xl border p-5 ${s.booking_enabled ? "bg-card" : "border-destructive/50 bg-destructive/10"}`}>
        <div>
          <div className="text-lg font-bold">{s.booking_enabled ? "الحجز شغّال" : "الحجز متوقف"}</div>
          <div className="text-sm text-muted-foreground">{s.booking_enabled ? "الزباين بيقدروا يحجزوا" : "لا أحد يقدر يحجز الآن"}</div>
        </div>
        <Switch checked={s.booking_enabled} onCheckedChange={(v) => save({ booking_enabled: v })} className="scale-125" />
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="font-bold">استراحة</h2>
        {pausedUntil ? (
          <div className="space-y-3">
            <p className="text-gold">
              باستراحة لحد {fmtTime(pausedUntil)} (باقي {left} دقيقة){s.pause_reason ? ` — ${s.pause_reason}` : ""}
            </p>
            <Button className="w-full" variant="gold" onClick={() => save({ pause_until: null, pause_reason: null })}>إنهاء الاستراحة الآن</Button>
          </div>
        ) : (
          <>
            <Input placeholder="السبب (اختياري، مثلاً: صلاة / غداء)" value={reason} onChange={(e) => setReason(e.target.value)} className="h-11" />
            <div className="grid grid-cols-4 gap-2">
              {[30, 60, 120, 180].map((m) => (
                <Button key={m} variant="outline" onClick={() => pause(m)}>
                  {m < 60 ? `${m}د` : `${m / 60}س`}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input type="number" inputMode="numeric" placeholder="دقائق مخصصة" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-11" />
              <Button variant="outline" onClick={() => Number(custom) > 0 && pause(Number(custom))}>ابدأ</Button>
            </div>
          </>
        )}
      </section>

      <section className="space-y-2 rounded-2xl border bg-card p-5">
        <h2 className="font-bold">التالي</h2>
        {next.length === 0 && <p className="text-sm text-muted-foreground">لا يوجد حجوزات قادمة</p>}
        {next.map((b) => (
          <div key={b.id} className="flex items-center gap-3">
            <span className="w-16 font-bold text-gold">{fmtTime(new Date(b.start_at))}</span>
            <span className="flex-1">
              {b.customer_name}
              {b.party_size > 1 && <span className="ms-2 text-xs text-muted-foreground">({b.party_size} أشخاص)</span>}
            </span>
            <Button size="sm" onClick={async () => { await patchBooking(b.id, { status: "done" }); loadNext(); }}>تم</Button>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-bold">زبون بدون حجز</h2>
        <div className="flex gap-2">
          <Input placeholder="الاسم" value={walkName} onChange={(e) => setWalkName(e.target.value)} className="h-11" />
          <Input placeholder="التلفون (اختياري)" dir="ltr" value={walkPhone} onChange={(e) => setWalkPhone(e.target.value)} className="h-11 text-right" />
        </div>
        <Button variant="gold" className="h-11 w-full" onClick={addWalkIn}>إدخال على أقرب موعد فارغ</Button>
      </section>

      <section className="rounded-2xl border bg-card p-4 text-center">
        <Button variant="outline" className="w-full" onClick={() => setShowQr(!showQr)}>
          {showQr ? "إخفاء رمز QR" : "رمز QR لتنزيل التطبيق"}
        </Button>
        {showQr && (
          <div className="mt-4 space-y-3">
            <div className="mx-auto w-fit rounded-xl bg-foreground p-4">
              <QRCodeSVG value={appUrl} size={220} />
            </div>
            <p className="text-sm text-muted-foreground">اطبع هذا الرمز وعلّقه بالصالون. الزبون يمسحه ثم "إضافة إلى الشاشة الرئيسية".</p>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>طباعة</Button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ───────────── REQUESTS ───────────── */

function RequestsTab({ onChange }: { onChange: () => void }) {
  const [rows, setRows] = useState<Booking[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("status", "pending")
      .order("start_at");
    setRows((data as unknown as Booking[]) ?? []);
    onChange();
  }, [onChange]);
  useEffect(() => {
    load();
    const ch = supabase.channel("req-live").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  async function decide(id: string, status: "approved" | "rejected") {
    await patchBooking(id, {
      status,
      decided_at: new Date().toISOString(),
      reject_reason: status === "rejected" ? reasons[id]?.trim() || null : null,
    });
    load();
  }

  async function approveAll() {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "approved", decided_at: new Date().toISOString() })
      .eq("status", "pending");
    if (error) toast.error("تعذر التحديث");
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">طلبات بانتظار الموافقة ({rows.length})</h2>
        {rows.length > 1 && <Button size="sm" variant="outline" onClick={approveAll}>موافقة على الكل</Button>}
      </div>
      {rows.length === 0 && <p className="rounded-xl bg-card p-5 text-center text-muted-foreground">لا توجد طلبات</p>}
      {rows.map((b) => (
        <div key={b.id} className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-bold">
                {b.customer_name}
                {b.party_size > 1 && <span className="ms-2 rounded bg-secondary px-1.5 py-0.5 text-xs">{b.party_size} أشخاص</span>}
              </div>
              {b.party_names && b.party_names.length > 1 && (
                <div className="text-xs text-muted-foreground">{b.party_names.filter(Boolean).join("، ")}</div>
              )}
              {b.phone && <a href={`tel:${b.phone}`} dir="ltr" className="text-sm text-muted-foreground">{b.phone}</a>}
            </div>
            <div className="text-end">
              <div className="font-bold text-gold">{fmtTime(new Date(b.start_at))}</div>
              <div className="text-xs text-muted-foreground">{fmtDay(ammanDate(new Date(b.start_at))).weekday}</div>
            </div>
          </div>
          <Input placeholder="سبب الرفض (اختياري)" value={reasons[b.id] ?? ""} onChange={(e) => setReasons((r) => ({ ...r, [b.id]: e.target.value }))} className="h-10" />
          <div className="flex gap-2">
            <Button className="flex-1" variant="gold" onClick={() => decide(b.id, "approved")}>موافقة ✅</Button>
            <Button className="flex-1" variant="outline" onClick={() => decide(b.id, "rejected")}>رفض ❌</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────── SCHEDULE ───────────── */

function ScheduleTab() {
  const days = useMemo(() => nextDays(8), []);
  const [day, setDay] = useState(days[0]!);
  const [rows, setRows] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [from, setFrom] = useState("15:00");
  const [to, setTo] = useState("16:00");
  const [why, setWhy] = useState("");

  const load = useCallback(async () => {
    const start = new Date(`${day}T00:00:00${OFFSET}`).toISOString();
    const end = new Date(`${day}T23:59:59${OFFSET}`).toISOString();
    const [b, bl] = await Promise.all([
      supabase.from("bookings").select("*").gte("start_at", start).lte("start_at", end).in("status", ["pending", "approved", "done", "no_show"]).order("start_at"),
      supabase.from("blocks").select("*").gte("end_at", start).lte("start_at", end).order("start_at"),
    ]);
    setRows((b.data as unknown as Booking[]) ?? []);
    setBlocks((bl.data as unknown as Block[]) ?? []);
  }, [day]);
  useEffect(() => {
    load();
    const ch = supabase.channel("sched-live").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, load).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  async function set(id: string, status: string) {
    await patchBooking(id, { status });
    load();
  }

  async function addBlock() {
    const a = new Date(`${day}T${from}:00${OFFSET}`);
    const b = new Date(`${day}T${to}:00${OFFSET}`);
    if (b <= a) { toast.error("الوقت غير صحيح"); return; }
    const { error } = await supabase.from("blocks").insert({ start_at: a.toISOString(), end_at: b.toISOString(), reason: why.trim() || null });
    if (error) toast.error("تعذر الإضافة");
    else { toast.success("تم إغلاق الفترة"); setWhy(""); load(); }
  }

  const active = rows.filter((r) => r.status === "approved" || r.status === "pending");
  const finished = rows.filter((r) => r.status === "done").length;

  return (
    <div className="space-y-4">
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
        {days.map((d, i) => {
          const f = fmtDay(d);
          return (
            <button key={d} onClick={() => setDay(d)} className={`min-w-[72px] shrink-0 rounded-xl border px-3 py-2 text-center ${d === day ? "border-primary bg-accent" : "bg-card"}`}>
              <div className="text-xs text-muted-foreground">{i === 0 ? "اليوم" : f.weekday}</div>
              <div className="text-sm font-bold">{f.date}</div>
            </button>
          );
        })}
      </div>

      <section className="space-y-2">
        <h2 className="font-bold">المواعيد ({active.length})</h2>
        {active.length === 0 && <p className="rounded-xl bg-card p-5 text-center text-muted-foreground">لا توجد حجوزات</p>}
        {active.map((b) => {
          const wa = waLink(b.phone);
          return (
            <div key={b.id} className="space-y-2 rounded-xl border bg-card p-3">
              <div className="flex items-center gap-3">
                <div className="w-16 text-center font-bold text-gold">{fmtTime(new Date(b.start_at))}</div>
                <div className="flex-1">
                  <div className="font-medium">
                    {b.customer_name}
                    {b.party_size > 1 && <span className="ms-2 rounded bg-secondary px-1.5 py-0.5 text-xs">{b.party_size} أشخاص</span>}
                    {b.walk_in && <span className="ms-2 rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">بدون حجز</span>}
                    {b.status === "pending" && <span className="ms-2 rounded bg-gold px-1.5 py-0.5 text-xs text-primary-foreground">معلّق</span>}
                  </div>
                  <div className="flex gap-3 text-sm text-muted-foreground">
                    {b.phone && <a href={`tel:${b.phone}`} dir="ltr">{b.phone}</a>}
                    {wa && <a href={wa} target="_blank" rel="noreferrer">واتساب</a>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {b.status === "pending" && <Button size="sm" variant="gold" onClick={() => set(b.id, "approved")}>موافقة</Button>}
                <Button size="sm" onClick={() => set(b.id, "done")}>تم</Button>
                <Button size="sm" variant="outline" onClick={() => set(b.id, "no_show")}>لم يحضر</Button>
                <Button size="sm" variant="ghost" onClick={() => set(b.id, "cancelled")}>إلغاء</Button>
              </div>
            </div>
          );
        })}
        {finished > 0 && <p className="pt-2 text-sm text-muted-foreground">تمت حلاقة {finished} حجز</p>}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-bold">إغلاق فترة</h2>
        <div className="flex gap-2" dir="ltr">
          <Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11" />
          <Input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="h-11" />
        </div>
        <Input placeholder="السبب (اختياري)" value={why} onChange={(e) => setWhy(e.target.value)} className="h-11" />
        <Button variant="outline" className="w-full" onClick={addBlock}>إغلاق الفترة</Button>
        {blocks.map((bl) => (
          <div key={bl.id} className="flex items-center justify-between text-sm">
            <span>{fmtTime(new Date(bl.start_at))} – {fmtTime(new Date(bl.end_at))} {bl.reason ? `· ${bl.reason}` : ""}</span>
            <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("blocks").delete().eq("id", bl.id); load(); }}>حذف</Button>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ───────────── ARCHIVE ───────────── */

function ArchiveTab() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [fromD, setFromD] = useState("");
  const [toD, setToD] = useState("");

  const load = useCallback(async () => {
    let query = supabase.from("bookings").select("*").lt("start_at", new Date().toISOString()).order("start_at", { ascending: false }).limit(300);
    if (status !== "all") query = query.eq("status", status);
    if (fromD) query = query.gte("start_at", new Date(`${fromD}T00:00:00${OFFSET}`).toISOString());
    if (toD) query = query.lte("start_at", new Date(`${toD}T23:59:59${OFFSET}`).toISOString());
    const { data } = await query;
    setRows((data as unknown as Booking[]) ?? []);
  }, [status, fromD, toD]);
  useEffect(() => {
    load();
  }, [load]);

  const shown = rows.filter((r) => {
    const t = q.trim().toLowerCase();
    return !t || r.customer_name.toLowerCase().includes(t) || (r.phone ?? "").includes(t);
  });

  function exportCsv() {
    const head = ["date", "time", "name", "phone", "people", "status", "walk_in"];
    const lines = shown.map((r) => {
      const d = new Date(r.start_at);
      return csvRow([ammanDate(d), fmtTime(d), r.customer_name, r.phone ?? "", r.party_size, r.status, r.walk_in ? "yes" : "no"]);
    });
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `archive-${ammanDate()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3">
      <h2 className="font-bold">الأرشيف</h2>
      <Input placeholder="بحث بالاسم أو الرقم" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
      <div className="flex gap-2" dir="ltr">
        <Input type="date" value={fromD} onChange={(e) => setFromD(e.target.value)} className="h-11" />
        <Input type="date" value={toD} onChange={(e) => setToD(e.target.value)} className="h-11" />
      </div>
      <div className="flex flex-wrap gap-2">
        {["all", "done", "no_show", "cancelled", "rejected", "approved"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full border px-3 py-1 text-xs ${status === s ? "border-primary bg-accent" : "bg-card"}`}>
            {s === "all" ? "الكل" : STATUS_AR[s]}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{shown.length} حجز</span>
        <Button size="sm" variant="outline" onClick={exportCsv}>تصدير CSV</Button>
      </div>
      {shown.map((r) => {
        const d = new Date(r.start_at);
        return (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm">
            <div className="w-20 text-center">
              <div className="font-bold">{fmtDay(ammanDate(d)).date}</div>
              <div className="text-xs text-muted-foreground">{fmtTime(d)}</div>
            </div>
            <div className="flex-1">
              <div>{r.customer_name}{r.party_size > 1 ? ` (${r.party_size})` : ""}</div>
              {r.phone && <div dir="ltr" className="text-start text-xs text-muted-foreground">{r.phone}</div>}
            </div>
            <span className="rounded bg-secondary px-2 py-0.5 text-xs">{STATUS_AR[r.status] ?? r.status}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── STATS ───────────── */

type Stats = {
  total: number;
  done: number;
  no_show: number;
  cancelled: number;
  rejected: number;
  people: number;
  unique_clients: number;
  by_hour: Record<string, number>;
  by_weekday: Record<string, number>;
};

const WEEKDAYS = ["", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"];

function StatsTab() {
  const [range, setRange] = useState(30);
  const [st, setSt] = useState<Stats | null>(null);
  useEffect(() => {
    const to = ammanDate();
    const from = ammanDate(new Date(Date.now() - range * 86400000));
    supabase.rpc("get_stats", { _from: from, _to: to }).then(({ data, error }) => {
      if (error) toast.error("تعذر تحميل الإحصائيات");
      else setSt(data as unknown as Stats);
    });
  }, [range]);

  function Bars({ data, label }: { data: Record<string, number>; label: (k: string) => string }) {
    const entries = Object.entries(data).sort((a, b) => Number(a[0]) - Number(b[0]));
    const max = Math.max(1, ...entries.map(([, v]) => v));
    if (entries.length === 0) return <p className="text-sm text-muted-foreground">لا توجد بيانات</p>;
    return (
      <div className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-muted-foreground">{label(k)}</span>
            <div className="h-3 flex-1 rounded bg-secondary">
              <div className="h-3 rounded bg-primary" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <span className="w-6 text-end">{v}</span>
          </div>
        ))}
      </div>
    );
  }

  const attended = st ? st.done + st.no_show : 0;
  const rate = st && attended > 0 ? Math.round((st.done / attended) * 100) : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[7, 30, 90].map((r) => (
          <button key={r} onClick={() => setRange(r)} className={`flex-1 rounded-xl border py-2 text-sm ${range === r ? "border-primary bg-accent" : "bg-card"}`}>
            {r} يوم
          </button>
        ))}
      </div>
      {!st ? (
        <p className="text-center text-muted-foreground">...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["حلاقات تمت", st.done],
              ["أشخاص", st.people],
              ["زبائن مختلفين", st.unique_clients],
              ["نسبة الحضور", rate === null ? "-" : `${rate}%`],
              ["لم يحضر", st.no_show],
              ["ملغاة / مرفوضة", st.cancelled + st.rejected],
            ].map(([l, v]) => (
              <div key={String(l)} className="rounded-xl border bg-card p-4 text-center">
                <div className="text-2xl font-bold text-gold">{v}</div>
                <div className="text-xs text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
          <section className="space-y-2 rounded-2xl border bg-card p-4">
            <h3 className="font-bold">الأيام الأكثر ازدحامًا</h3>
            <Bars data={st.by_weekday} label={(k) => WEEKDAYS[Number(k)] ?? k} />
          </section>
          <section className="space-y-2 rounded-2xl border bg-card p-4">
            <h3 className="font-bold">الساعات الأكثر ازدحامًا</h3>
            <Bars data={st.by_hour} label={(k) => `${k}:00`} />
          </section>
        </>
      )}
    </div>
  );
}

/* ───────────── SETTINGS ───────────── */

function SettingsTab() {
  const { s, save } = useSettings();
  const [f, setF] = useState<Settings | null>(null);
  const [pw, setPw] = useState("");
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [bPhone, setBPhone] = useState("");

  useEffect(() => {
    if (s) setF(s);
  }, [s]);

  const loadBlocked = useCallback(async () => {
    const { data } = await supabase.from("blocked_clients").select("*").order("created_at", { ascending: false });
    setBlocked((data as unknown as Blocked[]) ?? []);
  }, []);
  useEffect(() => {
    loadBlocked();
  }, [loadBlocked]);

  if (!f) return <p className="text-center text-muted-foreground">...</p>;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setF({ ...f, [k]: v });
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);
  const DAYS = [
    [7, "الأحد"], [1, "الاثنين"], [2, "الثلاثاء"], [3, "الأربعاء"], [4, "الخميس"], [5, "الجمعة"], [6, "السبت"],
  ] as const;

  async function saveAll() {
    if (!f) return;
    if (f.close_min <= f.open_min) { toast.error("وقت الإغلاق لازم يكون بعد الفتح"); return; }
    if (await save({
      service_minutes: f.service_minutes,
      buffer_minutes: f.buffer_minutes,
      open_min: f.open_min,
      close_min: f.close_min,
      days_off: f.days_off,
      booking_window_days: f.booking_window_days,
      max_party_size: f.max_party_size,
      max_bookings_per_device_24h: f.max_bookings_per_device_24h,
      auto_approve: f.auto_approve,
      min_notice_minutes: f.min_notice_minutes,
    })) toast.success("تم الحفظ");
  }

  async function changePw() {
    if (pw.length < 8) { toast.error("كلمة السر لازم 8 أحرف على الأقل"); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) toast.error("تعذر تغيير كلمة السر");
    else { toast.success("تم تغيير كلمة السر"); setPw(""); }
  }

  async function blockPhone() {
    const v = bPhone.replace(/\D/g, "").slice(-9);
    if (v.length < 7) return;
    await supabase.from("blocked_clients").insert({ kind: "phone", value: v });
    setBPhone("");
    loadBlocked();
  }

  const field = (label: string, node: React.ReactNode) => (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      {node}
    </label>
  );

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-bold">الحجز</h2>
        {field("موافقة تلقائية على الحجوزات", <Switch checked={f.auto_approve} onCheckedChange={(v) => set("auto_approve", v)} />)}
        {field("مدة الحلاقة (دقيقة)", <Input type="number" className="h-10 w-24" value={f.service_minutes} onChange={num("service_minutes")} />)}
        {field("راحة بين الحجوزات (دقيقة)", <Input type="number" className="h-10 w-24" value={f.buffer_minutes} onChange={num("buffer_minutes")} />)}
        {field("أقصى عدد أشخاص بالحجز", <Input type="number" className="h-10 w-24" value={f.max_party_size} onChange={num("max_party_size")} />)}
        {field("حجوزات لكل جهاز / 24 ساعة", <Input type="number" className="h-10 w-24" value={f.max_bookings_per_device_24h} onChange={num("max_bookings_per_device_24h")} />)}
        {field("الحجز مسموح لكم يوم قدّام", <Input type="number" className="h-10 w-24" value={f.booking_window_days} onChange={num("booking_window_days")} />)}
        {field("أقل مهلة قبل الموعد (دقيقة)", <Input type="number" className="h-10 w-24" value={f.min_notice_minutes} onChange={num("min_notice_minutes")} />)}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-bold">الدوام</h2>
        <div className="flex gap-3" dir="ltr">
          <Input type="time" className="h-10" value={minToHHMM(f.open_min)} onChange={(e) => set("open_min", hhmmToMin(e.target.value))} />
          <Input type="time" className="h-10" value={minToHHMM(f.close_min)} onChange={(e) => set("close_min", hhmmToMin(e.target.value))} />
        </div>
        <p className="text-xs text-muted-foreground">أيام العطلة:</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(([n, label]) => {
            const off = f.days_off.includes(n);
            return (
              <button
                key={n}
                onClick={() => set("days_off", off ? f.days_off.filter((x) => x !== n) : [...f.days_off, n])}
                className={`rounded-full border px-3 py-1 text-xs ${off ? "border-destructive bg-destructive/10" : "bg-card"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <Button variant="gold" size="xl" className="w-full" onClick={saveAll}>حفظ الإعدادات</Button>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-bold">حظر رقم</h2>
        <div className="flex gap-2">
          <Input dir="ltr" placeholder="07xxxxxxxx" value={bPhone} onChange={(e) => setBPhone(e.target.value)} className="h-10 text-right" />
          <Button variant="outline" onClick={blockPhone}>حظر</Button>
        </div>
        {blocked.map((b) => (
          <div key={b.id} className="flex items-center justify-between text-sm">
            <span dir="ltr">{b.kind === "phone" ? "📞" : "📱"} {b.value}</span>
            <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("blocked_clients").delete().eq("id", b.id); loadBlocked(); }}>فك الحظر</Button>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-bold">تغيير كلمة السر</h2>
        <Input type="password" dir="ltr" placeholder="كلمة سر جديدة (8 أحرف+)" value={pw} onChange={(e) => setPw(e.target.value)} className="h-10" />
        <Button variant="outline" className="w-full" onClick={changePw}>تغيير</Button>
      </section>
    </div>
  );
}
