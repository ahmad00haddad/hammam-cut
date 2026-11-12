import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Home, MapPin, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyBooking } from "@/lib/telegram.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapDialog } from "@/components/shop-map";
import { MyBookingDialog, TOKEN_KEY } from "@/components/my-booking";
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

type Result = { token: string; start: Date; party: number };

const STEP_AR = ["١", "٢", "٣"];
const pluralPeople = (n: number) => (n > 1 ? `${n} أشخاص` : "شخص واحد");

function Index() {
  const [state, setState] = useState<PublicState>(DEFAULT_STATE);
  const [todayState, setTodayState] = useState<PublicState>(DEFAULT_STATE);
  const days = useMemo(() => nextDays(state.window_days + 1), [state.window_days]);
  const [day, setDay] = useState<string>(() => ammanDate());
  const [dayTouched, setDayTouched] = useState(false);
  const [step, setStep] = useState(0);
  const [party, setParty] = useState(1);
  const [names, setNames] = useState<string[]>([]);
  const [picked, setPicked] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [mineOpen, setMineOpen] = useState(false);

  useEffect(() => {
    fetchState(day).then(setState).catch(() => {});
    fetchState(ammanDate()).then(setTodayState).catch(() => {});
  }, [day, tick]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // preselect the first open day (e.g. skip Monday) until the visitor picks one
  useEffect(() => {
    if (dayTouched) return;
    const first = days.find((d) => !isDayOff(d, state));
    if (first && first !== day) setDay(first);
  }, [days, state, day, dayTouched]);

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
  const ranges = useMemo(() => busyRanges(state), [state]);
  const slots = useMemo(() => {
    const now = Date.now();
    return slotsForDay(day, state).filter((s) => s.getTime() > now - 5 * 60000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, state, tick]);

  // on the times page, keep a valid slot selected
  useEffect(() => {
    if (step !== 1) return;
    if (picked && slotFits(picked, party, state, ranges) && picked.getTime() > Date.now() - 5 * 60000) return;
    const first = slots.find((s) => slotFits(s, party, state, ranges));
    setPicked(first ?? null);
  }, [step, slots, party, state, picked, ranges]);

  function changeParty(n: number) {
    setParty(n);
    setPicked(null);
    setNames((prev) => prev.slice(0, n - 1));
  }

  function resetFlow() {
    setResult(null);
    setLiveStatus(null);
    setPicked(null);
    setStep(0);
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
      else if (m.includes("taken")) { toast.error("هذا الموعد انحجز، اختر موعدًا آخر"); setStep(1); }
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
    setStep(3);
    setTick((x) => x + 1);
  }

  async function cancelMine() {
    if (!result) return;
    await supabase.rpc("cancel_my_booking", { _token: result.token });
    setLiveStatus("cancelled");
    setTick((x) => x + 1);
  }

  const statusChip =
    status === "off"
      ? { dot: "bg-destructive", text: "الحجز متوقف حاليًا" }
      : status === "paused"
        ? {
            dot: "bg-muted-foreground",
            text: `همام باستراحة، يرجع الساعة ${fmtTime(new Date(state.pause_until!))}${state.pause_reason ? ` · ${state.pause_reason}` : ""}`,
          }
        : available
          ? { dot: "animate-pulse bg-success", text: "همام متاح الآن" }
          : { dot: "bg-muted-foreground", text: "احجز موعدك وتبدأ الحلاقة فور وصولك" };

  const canBook = status !== "off";
  const screenClass = (i: number) =>
    `absolute inset-0 flex flex-col transition-transform duration-[450ms] ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none ${
      i === step ? "" : "pointer-events-none"
    }`;
  const screenStyle = (i: number) => ({ transform: `translateX(${-(i - step) * 100}%)` });

  const fmtD = fmtDay(day);

  return (
    <div className="mx-auto h-dvh max-w-md overflow-hidden md:border-x">
      <div className="relative h-full">
        {/* top: progress + back */}
        <header className="absolute inset-x-0 top-0 z-10 bg-background px-5 pb-3 pt-5">
          <div className="flex h-8 items-center gap-3">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              aria-label="رجوع"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary transition-opacity ${step > 0 && step < 3 ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={Math.min(step + 1, 3)}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-[450ms] ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none"
                    style={{ width: i <= step || step === 3 ? "100%" : "0%" }}
                  />
                </div>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {step < 3 ? `الخطوة ${STEP_AR[step]} من ٣` : "تم"}
          </p>
        </header>

        {/* step 1: welcome + people + day */}
        <section className={screenClass(0)} style={screenStyle(0)} aria-hidden={step !== 0} inert={step !== 0}>
          <div className="flex-1 overflow-y-auto px-5 pt-[5.5rem]">
            <h1 className="text-4xl font-bold leading-tight">أهلاً بك</h1>
            <p className="mt-1 text-sm text-muted-foreground">الدوام ١٢ ظهرًا – ١٠ ليلًا · الاثنين عطلة</p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm">
              <span className={`h-2 w-2 shrink-0 rounded-full ${statusChip.dot}`} />
              {statusChip.text}
            </p>

            <h2 className="mt-7 text-lg font-bold">كم شخص؟</h2>
            <div className="mt-3 flex gap-2">
              {Array.from({ length: state.max_party }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => changeParty(n)}
                  aria-pressed={n === party}
                  className={`h-12 flex-1 rounded-xl text-base font-bold transition active:scale-95 ${n === party ? "bg-primary text-primary-foreground" : "bg-card"}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-2 min-h-4 text-xs text-muted-foreground">
              {party > 1 ? `رح نحجزلكم ${party} مواعيد ورا بعض، حوالي ${party * (state.service_minutes + state.buffer_minutes)} دقيقة.` : ""}
            </p>

            <h2 className="mt-4 text-lg font-bold">اليوم</h2>
            <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-2">
              {days.map((d, i) => {
                const f = fmtDay(d);
                const active = d === day;
                const off = isDayOff(d, state);
                return (
                  <button
                    key={d}
                    onClick={() => { setDay(d); setDayTouched(true); setPicked(null); }}
                    aria-pressed={active}
                    className={`min-w-[72px] shrink-0 rounded-2xl px-3 py-3 text-center transition active:scale-95 ${
                      active ? "bg-primary text-primary-foreground" : "bg-card"
                    } ${off ? "opacity-40" : ""}`}
                  >
                    <div className={`text-xs ${active ? "opacity-80" : "text-muted-foreground"}`}>{i === 0 ? "اليوم" : f.weekday}</div>
                    <div className="mt-1 text-xl font-bold">{f.date}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-3 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <Button
              variant="gold"
              size="xl"
              className="w-full rounded-2xl"
              disabled={!canBook || closed}
              onClick={() => setStep(1)}
            >
              {closed ? "الصالون مغلق هذا اليوم" : "عرض الأوقات"}
            </Button>
            <nav aria-label="التنقل" className="mx-auto flex w-fit items-center gap-1 rounded-full border border-white/10 bg-[#101010] p-1.5">
              <span aria-current="page" className="flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background">
                <Home className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <button onClick={() => setMineOpen(true)} aria-label="حجزي" className="flex h-11 w-11 items-center justify-center rounded-full text-foreground/75 transition hover:text-foreground active:scale-95">
                <Ticket className="h-5 w-5" strokeWidth={1.7} />
              </button>
              <button onClick={() => setMapOpen(true)} aria-label="موقع الصالون" className="flex h-11 w-11 items-center justify-center rounded-full text-foreground/75 transition hover:text-foreground active:scale-95">
                <MapPin className="h-5 w-5" strokeWidth={1.7} />
              </button>
            </nav>
          </div>
        </section>

        {/* step 2: times */}
        <section className={screenClass(1)} style={screenStyle(1)} aria-hidden={step !== 1} inert={step !== 1}>
          <div className="flex-1 overflow-y-auto px-5 pt-[5.5rem]">
            <h1 className="text-3xl font-bold">الأوقات المتاحة</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {fmtD.weekday}، {fmtD.date} · {pluralPeople(party)}
            </p>
            {closed ? (
              <p className="mt-6 rounded-xl bg-card p-5 text-center text-muted-foreground">الصالون مغلق هذا اليوم</p>
            ) : slots.length === 0 ? (
              <p className="mt-6 rounded-xl bg-card p-5 text-center text-muted-foreground">لا توجد مواعيد متبقية اليوم. جرّب يوم ثاني.</p>
            ) : (
              <div className="mt-6 flex flex-wrap gap-2.5">
                {slots.map((s) => {
                  const fits = slotFits(s, party, state, ranges);
                  const isPicked = picked?.getTime() === s.getTime();
                  return (
                    <button
                      key={s.getTime()}
                      disabled={!fits}
                      onClick={() => setPicked(s)}
                      aria-pressed={isPicked}
                      className={`rounded-xl px-4 py-3 text-sm font-medium transition active:scale-95 ${
                        isPicked
                          ? "bg-primary text-primary-foreground"
                          : !fits
                            ? "cursor-not-allowed bg-card/50 text-muted-foreground/50 line-through"
                            : "bg-card"
                      }`}
                    >
                      {fmtTime(s)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
            <Button variant="gold" size="xl" className="w-full rounded-2xl" disabled={!picked} onClick={() => setStep(2)}>
              متابعة
            </Button>
          </div>
        </section>

        {/* step 3: details + confirm */}
        <section className={screenClass(2)} style={screenStyle(2)} aria-hidden={step !== 2} inert={step !== 2}>
          <div className="flex-1 overflow-y-auto px-5 pt-[5.5rem]">
            <h1 className="text-3xl font-bold">بياناتك</h1>
            {picked && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-card px-3 py-1.5">{fmtD.weekday}، {fmtD.date}</span>
                <span className="rounded-full bg-card px-3 py-1.5">{fmtTime(picked)}</span>
                <span className="rounded-full bg-card px-3 py-1.5">{pluralPeople(party)}</span>
              </div>
            )}
            <div className="mt-6 space-y-3">
              <Input placeholder="الاسم" aria-label="الاسم" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-12 rounded-xl" />
              <Input
                placeholder="رقم التلفون"
                aria-label="رقم التلفون"
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
                className="h-12 rounded-xl text-right"
              />
              {Array.from({ length: party - 1 }, (_, i) => (
                <Input
                  key={i}
                  placeholder={`اسم الشخص ${i + 2} (اختياري)`}
                  aria-label={`اسم الشخص ${i + 2}`}
                  value={names[i] ?? ""}
                  maxLength={60}
                  className="h-12 rounded-xl"
                  onChange={(e) =>
                    setNames((prev) => {
                      const next = [...prev];
                      next[i] = e.target.value;
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </div>
          <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
            <Button variant="gold" size="xl" className="w-full rounded-2xl" disabled={busy} onClick={book}>
              {busy ? "جارٍ الحجز..." : "تأكيد الحجز"}
            </Button>
          </div>
        </section>

        {/* ticket */}
        <section className={screenClass(3)} style={screenStyle(3)} aria-hidden={step !== 3} inert={step !== 3}>
          <div className="flex flex-1 flex-col justify-center px-5 pt-16">
            <div className="rounded-2xl border border-dashed border-foreground/30 p-6 text-center">
              {liveStatus === "rejected" ? (
                <>
                  <h1 className="text-2xl font-bold">تعذر قبول الحجز</h1>
                  <p className="mt-3 text-sm text-muted-foreground">نعتذر، همام ما قدر يقبل هذا الموعد. جرّب موعدًا آخر.</p>
                </>
              ) : liveStatus === "cancelled" ? (
                <h1 className="text-2xl font-bold">تم إلغاء الحجز</h1>
              ) : (
                <>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-6 w-6" />
                  </div>
                  <h1 className="mt-4 text-2xl font-bold">{liveStatus === "pending" ? "طلبك قيد المراجعة" : "تم تأكيد الحجز"}</h1>
                  {result && (
                    <>
                      <p className="mt-3 text-4xl font-bold">{fmtTime(result.start)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {fmtDay(ammanDate(result.start)).weekday}، {fmtDay(ammanDate(result.start)).date}
                        {result.party > 1 ? ` · ${result.party} أشخاص` : ""}
                      </p>
                    </>
                  )}
                  <p className="mt-4 text-xs text-muted-foreground">
                    {liveStatus === "pending"
                      ? "بتتحدث الحالة لحالها لما همام يوافق. لا تسكّر الصفحة."
                      : `الرجاء الحضور على الموعد. الحلاقة حوالي ${state.service_minutes} دقيقة للشخص.`}
                  </p>
                  <button onClick={cancelMine} className="mt-4 text-sm underline underline-offset-4">إلغاء حجزي</button>
                </>
              )}
            </div>
          </div>
          <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
            <Button size="xl" className="w-full rounded-2xl bg-foreground text-background hover:bg-foreground/90" onClick={resetFlow}>
              حجز موعد آخر
            </Button>
          </div>
        </section>
      </div>

      <MapDialog open={mapOpen} onOpenChange={setMapOpen} />
      <MyBookingDialog open={mineOpen} onOpenChange={setMineOpen} />
    </div>
  );
}
