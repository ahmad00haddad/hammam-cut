import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyBooking } from "@/lib/telegram.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_STATE,
  type PublicState,
  ammanDate,
  busyRanges,
  fmtDay,
  fmtTime,
  freeNow,
  getDeviceId,
  isDayOff,
  nextDays,
  parseLimitError,
  shopStatus,
  slotFits,
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

async function fetchState(day: string): Promise<PublicState> {
  const { data, error } = await supabase.rpc("get_public_state", { _day: day });
  if (error) throw error;
  return { ...DEFAULT_STATE, ...(data as unknown as PublicState) };
}

const TOKEN_KEY = "hm_last_token";

type Result = { token: string; start: Date; party: number };

function Index() {
  const [state, setState] = useState<PublicState>(DEFAULT_STATE);
  const [todayState, setTodayState] = useState<PublicState>(DEFAULT_STATE);
  const days = useMemo(() => nextDays(state.window_days + 1), [state.window_days]);
  const [day, setDay] = useState<string>(() => ammanDate());
  const [party, setParty] = useState(1);
  const [names, setNames] = useState<string[]>([]);
  const [picked, setPicked] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetchState(day).then(setState).catch(() => {});
    fetchState(ammanDate()).then(setTodayState).catch(() => {});
  }, [day, tick]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // follow the booking just made (pending -> approved / rejected)
  useEffect(() => {
    if (!result) return;
    const load = () =>
      supabase.rpc("get_booking_status", { _token: result.token }).then(({ data }) => {
        const st = (data as unknown as { status?: string } | null)?.status;
        if (st) setLiveStatus(st);
      });
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [result]);

  const status = shopStatus(state);
  const available = status === "open" && freeNow(todayState);
  const closed = isDayOff(day, state);
  const ranges = busyRanges(state);
  const now = Date.now();
  const slots = slotsForDay(day, state).filter((s) => s.getTime() > now - 5 * 60000);

  function changeParty(n: number) {
    setParty(n);
    setPicked(null);
    setNames((prev) => prev.slice(0, n - 1));
  }

  async function book() {
    if (!picked) return;
    if (name.trim().length < 2) { toast.error("اكتب اسمك"); return; }
    if (phone.replace(/\D/g, "").length < 7) { toast.error("اكتب رقم تلفون صحيح"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_booking", {
      _name: name.trim(),
      _phone: phone.trim(),
      _start: picked.toISOString(),
      _party_size: party,
      _device_id: getDeviceId(),
      _party_names: [name.trim(), ...names.map((n) => n.trim())].slice(0, party),
    });
    setBusy(false);
    if (error) {
      const m = error.message;
      const until = parseLimitError(m);
      if (until) toast.error(`وصلت للحد الأقصى للحجوزات. تقدر تحجز مرة ثانية الساعة ${fmtTime(until)}`, { duration: 8000 });
      else if (m.includes("taken")) toast.error("هذا الموعد انحجز، اختر موعدًا آخر");
      else if (m.includes("booking off") || m.includes("paused")) toast.error("الحجز متوقف حاليًا");
      else if (m.includes("not allowed")) toast.error("غير مسموح لك بالحجز");
      else toast.error("تعذر الحجز، حاول مرة أخرى");
      setTick((x) => x + 1);
      return;
    }
    const r = data as unknown as { id: string; token: string; status: string };
    notifyBooking({ data: { id: r.id } }).catch(() => {});
    try { localStorage.setItem(TOKEN_KEY, r.token); } catch { /* ignore */ }
    setLiveStatus(r.status);
    setResult({ token: r.token, start: picked, party });
    setPicked(null);
    setTick((x) => x + 1);
  }

  async function cancelMine() {
    if (!result) return;
    await supabase.rpc("cancel_my_booking", { _token: result.token });
    setLiveStatus("cancelled");
    setTick((x) => x + 1);
  }

  const banner =
    status === "off"
      ? { cls: "bg-card", dot: "bg-destructive", text: "الحجز متوقف حاليًا" }
      : status === "paused"
        ? {
            cls: "bg-card",
            dot: "bg-gold",
            text: `همام باستراحة، يرجع الساعة ${fmtTime(new Date(state.pause_until!))}${state.pause_reason ? ` — ${state.pause_reason}` : ""}`,
          }
        : available
          ? { cls: "border-success/50 bg-success/10", dot: "animate-pulse bg-success", text: "همام متاح الآن للحلاقة — تعال مباشرة!" }
          : { cls: "bg-card", dot: "bg-muted-foreground", text: "احجز موعدك لتبدأ الحلاقة فور وصولك" };

  return (
    <main className="mx-auto max-w-lg px-5 pb-16 pt-10">
      <header className="text-center">
        <img src="/icon-192.png" alt="شعار صالون H&M" width={88} height={88} className="mx-auto rounded-2xl shadow-glow" />
        <h1 className="mt-5 text-4xl font-bold text-gold">صالون H&M</h1>
        <p className="mt-2 text-muted-foreground">مع الحلاق همام · ١٢ ظهرًا – ١٠ مساءً · الاثنين عطلة</p>
      </header>

      <div className={`mt-8 flex items-center justify-center gap-3 rounded-2xl border p-4 ${banner.cls}`}>
        <span className={`h-3 w-3 shrink-0 rounded-full ${banner.dot}`} />
        <span className="font-medium">{banner.text}</span>
      </div>

      {result ? (
        <section className="mt-8 rounded-2xl border border-primary/40 bg-card p-6 text-center">
          {liveStatus === "rejected" ? (
            <>
              <h2 className="text-2xl font-bold">تعذر قبول الحجز</h2>
              <p className="mt-3 text-muted-foreground">نعتذر، همام ما قدر يقبل هذا الموعد. جرّب موعدًا آخر.</p>
            </>
          ) : liveStatus === "cancelled" ? (
            <h2 className="text-2xl font-bold">تم إلغاء الحجز</h2>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gold">
                {liveStatus === "pending" ? "طلبك قيد المراجعة ⏳" : "تم تأكيد الحجز ✂️"}
              </h2>
              <p className="mt-3 text-lg">
                {fmtDay(ammanDate(result.start)).weekday} الساعة {fmtTime(result.start)}
                {result.party > 1 ? ` · ${result.party} أشخاص` : ""}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {liveStatus === "pending"
                  ? "بانتظار موافقة همام. هاي الصفحة بتتحدث لحالها، لا تسكّرها."
                  : `الرجاء الحضور على الموعد، الحلاقة تستغرق حوالي ${state.service_minutes} دقيقة للشخص.`}
              </p>
              <Button variant="ghost" className="mt-3" onClick={cancelMine}>إلغاء حجزي</Button>
            </>
          )}
          <Button variant="outline" className="mt-5 block w-full" onClick={() => { setResult(null); setLiveStatus(null); }}>
            حجز موعد آخر
          </Button>
        </section>
      ) : status === "off" ? null : (
        <>
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold">كم شخص؟</h2>
            <div className="flex gap-2">
              {Array.from({ length: state.max_party }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => changeParty(n)}
                  className={`h-12 flex-1 rounded-xl border font-bold transition ${n === party ? "border-primary bg-accent text-accent-foreground" : "bg-card"}`}
                >
                  {n}
                </button>
              ))}
            </div>
            {party > 1 && (
              <p className="mt-2 text-xs text-muted-foreground">
                رح نحجزلكم {party} مواعيد ورا بعض (حوالي {party * (state.service_minutes + state.buffer_minutes)} دقيقة).
              </p>
            )}
          </section>

          <section className="mt-6">
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
                    } ${isDayOff(d, state) ? "opacity-50" : ""}`}
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
              <p className="rounded-xl bg-card p-5 text-center text-muted-foreground">الصالون مغلق هذا اليوم</p>
            ) : slots.length === 0 ? (
              <p className="rounded-xl bg-card p-5 text-center text-muted-foreground">لا توجد مواعيد متبقية اليوم</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => {
                  const fits = slotFits(s, party, state, ranges);
                  const isPicked = picked?.getTime() === s.getTime();
                  return (
                    <button
                      key={s.getTime()}
                      disabled={!fits}
                      onClick={() => setPicked(s)}
                      className={`rounded-lg border py-3 text-sm font-medium transition ${
                        isPicked
                          ? "bg-gold border-transparent text-primary-foreground"
                          : !fits
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
                {party > 1 ? ` · ${party} أشخاص` : ""}
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
              {Array.from({ length: party - 1 }, (_, i) => (
                <Input
                  key={i}
                  placeholder={`اسم الشخص ${i + 2} (اختياري)`}
                  value={names[i] ?? ""}
                  maxLength={60}
                  className="h-12"
                  onChange={(e) =>
                    setNames((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                />
              ))}
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
