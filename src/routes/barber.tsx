import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RazorMark } from "@/components/razor-mark";
import { AdminDashboard } from "@/components/admin-dashboard";

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
  return <AdminDashboard />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-5 text-center">{children}</main>;
}

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const u = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    const { error } = await supabase.auth.signInWithPassword({ email: `${u}@hm-salon.local`, password });
    if (error) toast.error("اسم المستخدم أو كلمة المرور غير صحيحة");
    setBusy(false);
  }

  return (
    <Centered>
      <RazorMark animated className="mx-auto h-7 w-auto text-foreground" />
      <h1 className="text-3xl font-bold text-gold">دخول الحلاق</h1>
      <form onSubmit={submit} className="space-y-3 text-right">
        <Input dir="ltr" autoCapitalize="none" autoComplete="username" placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} required className="h-12" />
        <Input type="password" dir="ltr" autoComplete="current-password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12" />
        <Button variant="gold" size="xl" className="w-full" disabled={busy}>دخول</Button>
      </form>
      <Link to="/" className="text-xs text-muted-foreground">صفحة الحجز</Link>
    </Centered>
  );
}
