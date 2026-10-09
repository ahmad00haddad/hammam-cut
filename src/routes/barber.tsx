import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ammanDate, fmtDay, fmtTime, nextDays, slotsForDay, SLOT_MIN } from "@/lib/slots";

export const Route = createFileRoute("/barber")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة الحلاق — صالون H&M" },
      { name: "description", content: "لوحة همام لإدارة حجوزات صالون H&M." },
      { property: "og:title", content: "لوحة الحلاق — صالون H&M" },
      { property: "og:description", content: "إدارة الحجوزات والزبائن في صالون H&M." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BarberPage,
});

type Booking = {
  id: string;
  customer_name: string;
  phone: string | null;
  start_at: string;
  status: string;
  walk_in: boolean;
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

function BarberPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return setIsAdmin(null);
    supabase
      .rpc("has_role", { _user_id: session.user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  if (!ready) return null;
  if (!session) return <Login />;
  if (isAdmin === null) return null;
  if (!isAdmin)
    return (
      <Centered>
        <p>هذا الحساب ليس حساب الحلاق.</p>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>تسجيل الخروج</Button>
      </Centered>
    );
  return <Dashboard />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-5 text-center">{children}</main>;
}

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("البريد أو كلمة المرور غير صحيحة");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/barber` },
      });
      if (error) toast.error(error.message);
      else if (!data.session) toast.success("تم إنشاء الحساب. افتح بريدك واضغط رابط التأكيد ثم سجّل الدخول.");
    }
    setBusy(false);
  }

  return (
    <Centered>
      <h1 className="text-3xl font-bold text-gold">دخول الحلاق</h1>
      <form onSubmit={submit} className="space-y-3 text-right">
        <Input type="email" dir="ltr" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12" />
        <Input type="password" dir="ltr" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-12" />
        <Button variant="gold" size="xl" className="w-full" disabled={busy}>
          {mode === "in" ? "دخول" : "إنشاء حساب"}
        </Button>
      </form>
      <button className="text-sm text-muted-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "أول مرة؟ أنشئ حساب الحلاق" : "عندي حساب، تسجيل الدخول"}
      </button>
      <Link to="/" className="text-xs text-muted-foreground">صفحة الحجز</Link>
    </Centered>
  );
}

function Dashboard() {
  const days = useMemo(() => nextDays(8), []);
  const [day, setDay] = useState<string>(days[0]!);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");

  const load = useCallback(async () => {
    const start = new Date(`${day}T00:00:00+03:00`).toISOString();
    const end = new Date(`${day}T23:59:59+03:00`).toISOString();
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .gte("start_at", start)
      .lte("start_at", end)
      .neq("status", "cancelled")
      .order("start_at");
    setBookings((data as Booking[]) ?? []);
  }, [day]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("bookings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, (p) => {
        if (p.eventType === "INSERT") {
          const b = p.new as Booking;
          if (!b.walk_in) {
            beep();
            toast.success(`حجز جديد: ${b.customer_name} — ${fmtTime(new Date(b.start_at))}`, { duration: 10000 });
          }
        }
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  async function setStatus(id: string, status: string) {
    await supabase.from("bookings").update({ status }).eq("id", id);
    load();
  }

  async function addWalkIn() {
    if (walkName.trim().length < 2) { toast.error("اكتب اسم الزبون"); return; }
    const today = ammanDate();
    const { data } = await supabase.rpc("get_taken_slots", { _day: today });
    const taken = new Set(((data as unknown as string[]) ?? []).map((s) => new Date(s).getTime()));
    const now = Date.now();
    const slot = slotsForDay(today).find(
      (s) => s.getTime() + SLOT_MIN * 60000 > now && !taken.has(s.getTime()),
    );
    if (!slot) { toast.error("لا يوجد وقت فارغ اليوم"); return; }
    const { error } = await supabase.from("bookings").insert({
      customer_name: walkName.trim(),
      phone: walkPhone.trim() || null,
      start_at: slot.toISOString(),
      walk_in: true,
    });
    if (error) { toast.error("تعذر الإضافة"); return; }
    toast.success(`تمت إضافة ${walkName} الساعة ${fmtTime(slot)}`);
    setWalkName("");
    setWalkPhone("");
    if (day !== today) setDay(today);
    else load();
  }

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const active = bookings.filter((b) => b.status === "booked");
  const done = bookings.filter((b) => b.status === "done");

  return (
    <main className="mx-auto max-w-lg px-5 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gold">أهلاً همام</h1>
          <p className="text-sm text-muted-foreground">الحجوزات تظهر هنا مباشرة مع صوت تنبيه</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>خروج</Button>
      </header>

      <section className="mt-6 space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-bold">زبون بدون حجز</h2>
        <div className="flex gap-2">
          <Input placeholder="الاسم" value={walkName} onChange={(e) => setWalkName(e.target.value)} className="h-11" />
          <Input placeholder="التلفون (اختياري)" dir="ltr" value={walkPhone} onChange={(e) => setWalkPhone(e.target.value)} className="h-11 text-right" />
        </div>
        <Button variant="gold" className="h-11 w-full" onClick={addWalkIn}>إدخال على أقرب موعد فارغ</Button>
      </section>

      <div className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-2">
        {days.map((d, i) => {
          const f = fmtDay(d);
          return (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`min-w-[72px] shrink-0 rounded-xl border px-3 py-2 text-center ${d === day ? "border-primary bg-accent" : "bg-card"}`}
            >
              <div className="text-xs text-muted-foreground">{i === 0 ? "اليوم" : f.weekday}</div>
              <div className="text-sm font-bold">{f.date}</div>
            </button>
          );
        })}
      </div>

      <section className="mt-4 space-y-2">
        <h2 className="font-bold">المواعيد ({active.length})</h2>
        {active.length === 0 && <p className="rounded-xl bg-card p-5 text-center text-muted-foreground">لا توجد حجوزات</p>}
        {active.map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <div className="w-16 text-center font-bold text-gold">{fmtTime(new Date(b.start_at))}</div>
            <div className="flex-1">
              <div className="font-medium">
                {b.customer_name}
                {b.walk_in && <span className="ms-2 rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">بدون حجز</span>}
              </div>
              {b.phone && <a href={`tel:${b.phone}`} dir="ltr" className="text-sm text-muted-foreground">{b.phone}</a>}
            </div>
            <Button size="sm" onClick={() => setStatus(b.id, "done")}>تم</Button>
            <Button size="sm" variant="ghost" onClick={() => setStatus(b.id, "cancelled")}>إلغاء</Button>
          </div>
        ))}
        {done.length > 0 && <p className="pt-2 text-sm text-muted-foreground">تمت حلاقة {done.length} زبون</p>}
      </section>

      <section className="mt-8 rounded-2xl border bg-card p-4 text-center">
        <Button variant="outline" className="w-full" onClick={() => setShowQr(!showQr)}>
          {showQr ? "إخفاء رمز QR" : "رمز QR لتنزيل التطبيق"}
        </Button>
        {showQr && (
          <div className="mt-4 space-y-3">
            <div className="mx-auto w-fit rounded-xl bg-foreground p-4">
              <QRCodeSVG value={appUrl} size={220} />
            </div>
            <p className="text-sm text-muted-foreground">
              اطبع هذا الرمز وعلّقه بالصالون. الزبون يمسحه، ثم من المتصفح يختار "إضافة إلى الشاشة الرئيسية".
            </p>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>طباعة</Button>
          </div>
        )}
      </section>
    </main>
  );
}
