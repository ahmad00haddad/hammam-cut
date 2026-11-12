<p align="center">
  <img src="public/icon-512.png" alt="H&M razor logo" width="140" />
</p>

<h1 align="center">صالون H&M — Hammam Cut</h1>

<p align="center">
  تطبيق ويب (PWA) لحجز مواعيد الحلاقة عند همام.<br />
  PWA for booking a haircut at the H&M barber shop.
</p>

<p align="center">
  <b><a href="https://hammam-cut.lovable.app">hammam-cut.lovable.app</a></b>
</p>

<p align="center">
  <img src="public/og-image.png" alt="H&M preview" width="640" />
</p>

## المزايا / Features

- **حجز بدون انتظار**: الزبون يختار اليوم والوقت (مدة الحلاقة ≈ ٢٠ دقيقة) ويحصل على تذكرة وملف تقويم.
- **أوقات الدوام**: يوميًا من ١٢ ظهرًا حتى ١٠ مساءً، والاثنين عطلة. إذا لم يكن هناك حجوزات يظهر «همام متاح الآن».
- **لوحة الحلاق** (`/barber`): تظهر الحجوزات مباشرة على الهاتف، مع قبول/رفض وإدخال زبون حضر بدون حجز وتصدير CSV.
- **إشعارات تيليجرام**: كل حجز جديد يصل لهمام مع أزرار قبول/رفض وأوامر للمالك، وإشعار عند الإلغاء.
- **تذكّر الزبون العائد**: الاسم والرقم وأسماء المرافقين، مع رسالة ترحيب وزر «انسَني».
- **حجز لأكثر من شخص**، رقم هاتف أردني، حدود على الحجوزات المعلّقة والملغاة لمنع الإساءة.
- **التثبيت على الهاتف**: عبر QR code أو زر المشاركة (أندرويد وآيفون)، يعمل كتطبيق مستقل.
- **الأسعار**: من ٣ إلى ١٠ دنانير حسب الخدمة.
- **الهوية**: شعار موس الحلاقة المتحرك (اضغط عليه ليُطوى/يُفتح)، تصميم داكن بلون عنابي، واجهة عربية RTL.

## التقنيات / Stack

TanStack Start (React + Vite) · Tailwind + shadcn/ui · Supabase (Postgres, RPC, RLS) · Drizzle · Telegram Bot API · Vitest.

## التطوير / Development

```sh
git clone https://github.com/ahmad00haddad/hammam-cut.git
cd hammam-cut
npm i
npm run dev      # dev server
npm test         # unit tests
npm run build    # production build
```

Migrations are in `supabase/` and `drizzle/`. Telegram webhook setup: `scripts/telegram-webhook.mjs`.

## الصور ومعاينة الرابط / Icons & link preview

- أيقونات التطبيق: `public/` (مصدر الشعار في `design/logo/`).
- صورة معاينة الرابط (واتساب، فيسبوك، تيليجرام…): `public/og-image.png` (١٢٠٠×٦٣٠)، تُولَّد بـ `python scripts/make-og.py`.
- عند تغيير الصورة ارفع رقم `?v=` في `src/routes/__root.tsx` ليُحدّث الجميع المعاينة المخزّنة.

## التوثيق / Docs

- [docs/SECURITY.md](docs/SECURITY.md) — ملاحظات الأمان
- [docs/UPGRADE_PLAN.md](docs/UPGRADE_PLAN.md) — خطة التطوير

## Credits

Built with [Lovable](https://lovable.dev/projects/7793ec1c-b8ba-444c-ba20-7265abf15770); changes pushed to `main` sync back into Lovable.
