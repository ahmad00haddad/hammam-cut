import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyBooking } from "@/lib/telegram.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapButton } from "@/components/shop-map";
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

  const statusLine =
    status === "off"
      ? { dot: "bg-destructive", text: "الحجز متوقف حاليًا" }
      : status === "paused"
        ? {
            dot: "bg-muted-foreground",
            text: `همام باستراحة، يرجع الساعة ${fmtTime(new Date(state.pause_until!))}${state.pause_reason ? ` · ${state.pause_reason}` : ""}`,
          }
        : available
          ? { dot: "animate-pulse bg-success", text: "همام متاح الآن، تعال مباشرة" }
          : { dot: "bg-muted-foreground", text: "احجز موعدك وتبدأ الحلاقة فور وصولك" };

  return (
    <div>
      <header className="bg-primary text-primary-foreground">
        <div className="relative mx-auto max-w-lg px-5 pb-9 pt-7">
          <img src="/icon-192.png" alt="" width={44} height={44} className="rounded-sm" />
          <MapButton />
          <p className="mt-8 text-sm tracking-wide opacity-80">حلاقة رجالية · الحلاق همام</p>
          <h1 className="mt-1 text-6xl font-bold leading-none">صالون H&M</h1>
        </div>
      </header>
      <div className="pole" aria-hidden="true" />

      <main className="mx-auto max-w-lg px-5 pb-16">
        <dl className="grid grid-cols-3 divide-x divide-x-reverse divide-border border-b text-sm">
          {[
            ["الدوام", "١٢ ظهرًا – ١٠ ليلًا"],
            ["العطلة", "الاثنين"],
            ["الأسعار", "٣ – ١٠ دنانير"],
          ].map(([k, v]) => (
            <div key={k} className="px-3 py-4 first:ps-0 last:pe-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="mt-1 font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <p className="flex items-center gap-3 border-b py-4 text-sm">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusLine.dot}`} />
          <span>{statusLine.text}</span>
        </p>

        {result ? (
          <section className="mt-8 border border-dashed border-foreground/40 p-6">
            <p className="text-xs tracking-widest text-muted-foreground">
              {liveStatus === "pending" ? "طلب قيد المراجعة" : liveStatus === "approved" ? "موعد مؤكد" : "حالة الحجز"}
            </p>
            {liveStatus === "rejected" ? (
              <>
                <h2 className="mt-2 text-3xl font-bold">تعذر قبول الحجز</h2>
                <p className="mt-3 text-muted-foreground">نعتذر، همام ما قدر يقبل هذا الموعد. جرّب موعدًا آخر.</p>
              </>
            ) : liveStatus === "cancelled" ? (
              <h2 className="mt-2 text-3xl font-bold">تم إلغاء الحجز</h2>
            ) : (
              <>
                <h2 className="mt-2 text-5xl font-bold">{fmtTime(result.start)}</h2>
                <p className="mt-2 text-lg">
                  {fmtDay(ammanDate(result.start)).weekday}، {fmtDay(ammanDate(result.start)).date}
                  {result.party > 1 ? ` · ${result.party} أشخاص` : ""}
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  {liveStatus === "pending"
                    ? "بانتظار موافقة همام. هاي الصفحة بتتحدث لحالها، لا تسكّرها."
                    : `الرجاء الحضور على الموعد. الحلاقة حوالي ${state.service_minutes} دقيقة للشخص.`}
                </p>
                <button onClick={cancelMine} className="mt-4 text-sm underline underline-offset-4">إلغاء حجزي</button>
              </>
            )}
            <Button variant="gold" size="xl" className="mt-6 w-full" onClick={() => { setResult(null); setLiveStatus(null); }}>
              حجز موعد آخر
            </Button>
          </section>
        ) : status === "off" ? null : (
          <>
            <Step n="01" title="كم شخص؟">
              <div className="flex divide-x divide-x-reverse divide-border border">
                {Array.from({ length: state.max_party }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => changeParty(n)}
                    aria-pressed={n === party}
                    className={`h-12 flex-1 font-bold transition-colors ${n === party ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {party > 1 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  رح نحجزلكم {party} مواعيد ورا بعض، حوالي {party * (state.service_minutes + state.buffer_minutes)} دقيقة.
                </p>
              )}
            </Step>

            <Step n="02" title="اليوم">
              <div className="-mx-5 flex overflow-x-auto border-y px-5">
                {days.map((d, i) => {
                  const f = fmtDay(d);
                  const active = d === day;
                  const off = isDayOff(d, state);
                  return (
                    <button
                      key={d}
                      onClick={() => { setDay(d); setPicked(null); }}
                      aria-pressed={active}
                      className={`min-w-[84px] shrink-0 border-e px-3 py-3 text-start transition-colors first:border-s ${
                        active ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                      } ${off ? "opacity-40" : ""}`}
                    >
                      <div className="text-xs opacity-70">{i === 0 ? "اليوم" : f.weekday}</div>
                      <div className="mt-1 text-lg font-bold">{f.date}</div>
                    </button>
                  );
                })}
              </div>
            </Step>

            <Step n="03" title="الوقت">
              {closed ? (
                <p className="border p-5 text-muted-foreground">الصالون مغلق هذا اليوم</p>
              ) : slots.length === 0 ? (
                <p className="border p-5 text-muted-foreground">لا توجد مواعيد متبقية اليوم</p>
              ) : (
                <div className="grid grid-cols-3 gap-px border bg-border">
                  {slots.map((s) => {
                    const fits = slotFits(s, party, state, ranges);
                    const isPicked = picked?.getTime() === s.getTime();
                    return (
                      <button
                        key={s.getTime()}
                        disabled={!fits}
                        onClick={() => setPicked(s)}
                        aria-pressed={isPicked}
                        className={`py-3.5 text-sm font-medium transition-colors ${
                          isPicked
                            ? "bg-primary text-primary-foreground"
                            : !fits
                              ? "cursor-not-allowed bg-background text-muted-foreground/50 line-through"
                              : "bg-background hover:bg-secondary"
                        }`}
                      >
                        {fmtTime(s)}
                      </button>
                    );
                  })}
                </div>
              )}
            </Step>

            {picked && (
              <Step n="04" title="بياناتك">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    الموعد: <span className="font-bold text-foreground">{fmtTime(picked)}</span>
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
                </div>
              </Step>
            )}
          </>
        )}

        <footer className="mt-14 border-t pt-4 text-center text-xs text-muted-foreground">
          <Link to="/barber" className="hover:text-foreground">دخول الحلاق</Link>
        </footer>
      </main>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 flex items-baseline gap-3 text-xl font-bold">
        <span className="text-sm font-normal tabular-nums text-muted-foreground">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
