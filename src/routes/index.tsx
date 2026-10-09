import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ammanDate,
  fmtDay,
  fmtTime,
  freeNow,
  isMonday,
  nextDays,
  slotsForDay,
} from "@/lib/slots";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "صالون H&M — احجز موعدك مع همام" },
      { name: "description", content: "احجز موعد حلاقتك في صالون H&M بسهولة. مفتوح يوميًا من ١٢ ظهرًا حتى ١٠ مساءً، والاثنين عطلة." },
      { property: "og:title", content: "صالون H&M — احجز موعدك مع همام" },
      { property: "og:description", content: "احجز موعد حلاقتك في صالون H&M بسهولة وبدون انتظار." },
    ],
  }),
  component: Index,
});

async function fetchTaken(day: string): Promise<Date[]> {
  const { data, error } = await supabase.rpc("get_taken_slots", { _day: day });
  if (error) throw error;
  return ((data as unknown as string[]) ?? []).map((s) => new Date(s));
}

function Index() {
  const days = useMemo(() => nextDays(8), []);
  const [day, setDay] = useState<string>(days[0]!);
  const [taken, setTaken] = useState<Date[]>([]);
  const [todayTaken, setTodayTaken] = useState<Date[]>([]);
  const [picked, setPicked] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetchTaken(day).then(setTaken).catch(() => {});
    fetchTaken(ammanDate()).then(setTodayTaken).catch(() => {});
  }, [day, tick]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const available = freeNow(todayTaken);
  const closed = isMonday(day);
  const now = Date.now();
  const slots = slotsForDay(day).filter((s) => s.getTime() > now - 5 * 60000);
  const takenSet = new Set(taken.map((t) => t.getTime()));

  async function book() {
    if (!picked) return undefined;
    if (name.trim().length < 2) { toast.error("اكتب اسمك"); return; }
    if (phone.replace(/\D/g, "").length < 7) { toast.error("اكتب رقم تلفون صحيح"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("create_booking", {
      _name: name.trim(),
      _phone: phone.trim(),
      _start: picked.toISOString(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("taken") ? "هذا الموعد انحجز، اختر موعدًا آخر" : "تعذر الحجز، حاول مرة أخرى");
      setTick((x) => x + 1);
      return;
    }
    setDone(picked);
    setPicked(null);
    setTick((x) => x + 1);
  }

  return (
    <main className="mx-auto max-w-lg px-5 pb-16 pt-10">
      <header className="text-center">
        <img src="/icon-192.png" alt="شعار صالون H&M" width={88} height={88} className="mx-auto rounded-2xl shadow-glow" />
        <h1 className="mt-5 text-4xl font-bold text-gold">صالون H&M</h1>
        <p className="mt-2 text-muted-foreground">مع الحلاق همام · ١٢ ظهرًا – ١٠ مساءً · الاثنين عطلة</p>
      </header>

      <div
        className={`mt-8 flex items-center justify-center gap-3 rounded-2xl border p-4 ${
          available ? "border-success/50 bg-success/10" : "bg-card"
        }`}
      >
        <span className={`h-3 w-3 rounded-full ${available ? "animate-pulse bg-success" : "bg-muted-foreground"}`} />
        <span className="font-medium">
          {available ? "همام متاح الآن للحلاقة — تعال مباشرة!" : "احجز موعدك لتبدأ الحلاقة فور وصولك"}
        </span>
      </div>

      {done ? (
        <section className="mt-8 rounded-2xl border border-primary/40 bg-card p-6 text-center">
          <h2 className="text-2xl font-bold text-gold">تم الحجز ✂️</h2>
          <p className="mt-3 text-lg">موعدك {fmtDay(ammanDate(done)).weekday} الساعة {fmtTime(done)}</p>
          <p className="mt-2 text-sm text-muted-foreground">الرجاء الحضور على الموعد، الحلاقة تستغرق حوالي ٢٠ دقيقة.</p>
          <Button variant="outline" className="mt-5" onClick={() => setDone(null)}>
            حجز موعد آخر
          </Button>
        </section>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold">اختر اليوم</h2>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
              {days.map((d, i) => {
                const f = fmtDay(d);
                const active = d === day;
                return (
                  <button
                    key={d}
                    onClick={() => { setDay(d); setPicked(null); }}
                    className={`min-w-[76px] shrink-0 rounded-xl border px-3 py-3 text-center transition ${
                      active ? "border-primary bg-accent text-accent-foreground" : "bg-card"
                    } ${isMonday(d) ? "opacity-50" : ""}`}
                  >
                    <div className="text-xs text-muted-foreground">{i === 0 ? "اليوم" : f.weekday}</div>
                    <div className="mt-1 font-bold">{f.date}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-lg font-bold">اختر الوقت</h2>
            {closed ? (
              <p className="rounded-xl bg-card p-5 text-center text-muted-foreground">الصالون مغلق يوم الاثنين</p>
            ) : slots.length === 0 ? (
              <p className="rounded-xl bg-card p-5 text-center text-muted-foreground">لا توجد مواعيد متبقية اليوم</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => {
                  const isTaken = takenSet.has(s.getTime());
                  const isPicked = picked?.getTime() === s.getTime();
                  return (
                    <button
                      key={s.getTime()}
                      disabled={isTaken}
                      onClick={() => setPicked(s)}
                      className={`rounded-lg border py-3 text-sm font-medium transition ${
                        isPicked
                          ? "bg-gold border-transparent text-primary-foreground"
                          : isTaken
                            ? "cursor-not-allowed bg-muted text-muted-foreground line-through opacity-50"
                            : "bg-card hover:border-primary"
                      }`}
                    >
                      {fmtTime(s)}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {picked && (
            <section className="mt-6 space-y-3 rounded-2xl border bg-card p-5">
              <p className="font-medium">
                الموعد: <span className="text-gold">{fmtTime(picked)}</span>
              </p>
              <Input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-12" />
              <Input
                placeholder="رقم التلفون"
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
                className="h-12 text-right"
              />
              <Button variant="gold" size="xl" className="w-full" disabled={busy} onClick={book}>
                {busy ? "جارٍ الحجز..." : "تأكيد الحجز"}
              </Button>
            </section>
          )}
        </>
      )}

      <footer className="mt-12 text-center text-xs text-muted-foreground">
        <Link to="/barber" className="hover:text-foreground">دخول الحلاق</Link>
      </footer>
    </main>
  );
}
