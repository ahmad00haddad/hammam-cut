# أسلوب الحركة المرنة (Elastic Motion)

دليل قابل للنقل لأي مشروع. مأخوذ من تطبيقه على Memoria (نوفمبر 2026).

## الفلسفة

- **بسيط فقط.** حركة واحدة صغيرة لكل حدث، لا سلاسل حركات.
- **تكاد لا تُلاحَظ.** المستخدم يحسّ أن الواجهة "حيّة" بدون أن يرى حركة بعينها. التجاوز (overshoot) بين 2% و8% غالباً.
- **راقية وخفيفة.** لا ارتداد كرتوني، لا اهتزاز طويل.
- **الماوس يبقى طبيعياً.** ممنوع: عناصر تتبع المؤشر، ميلان ثلاثي الأبعاد عند المرور (tilt)، مغناطيس على الأزرار، مؤشر مخصص.
- **لا تريندات قديمة:** لا parallax ثقيل، لا نجوم/لمعان، لا glitch، لا typewriter، لا flip ثلاثي الأبعاد.
- **الحركة تستجيب لفعل أو تغيّر قيمة**، لا تعمل في حلقة لوحدها.
- **`prefers-reduced-motion` إلزامي** لكل تأثير.

## المنحنيات (Easing)

| الاسم | القيمة | الاستخدام |
|---|---|---|
| EB (مرن) | `cubic-bezier(0.34, 1.56, 0.64, 1)` | الافتراضي: ضغط، ظهور، قفزة قيمة |
| ES (مرن ناعم) | `cubic-bezier(0.34, 1.3, 0.64, 1)` | حركات الإزاحة الكبيرة (لوحات، أقسام) |
| Settle | `[0.3, 1.25, 0.5, 1]` | عدّادات أرقام: تتجاوز بشعرة ثم تستقر |
| Back-in | `cubic-bezier(0.36, 0, 0.66, -0.56)` | انكماش واختفاء (نقطة مقروء) |
| Ease-out | `cubic-bezier(0.22, 1, 0.36, 1)` | الشفافية وكل ما لا يجب أن يتجاوز |

**قاعدة:** المرونة على الموضع والحجم فقط. الشفافية والألوان دائماً بدون تجاوز (`ease` عادي، 0.15–0.3s).

### Springs (framer-motion)

| الحالة | stiffness / damping |
|---|---|
| زر صغير يظهر (✕ المسح، شارة) | 500 / 24 |
| شارات تنزاح لمكانها | 420 / 30 |
| تبويب يتبدّل (y: 6 → 0) | 380 / 26 |
| انزلاق شهر في تقويم | 320 / 22 |
| بطاقات نتائج تصعد | 140 / 20 |
| ظهور الأقسام عند النزول | 110 / 19 |
| حلقة نسبة تمتلئ | 90 / 11 |

كلما كبر العنصر أو المسافة → stiffness أقل. damping تحت 15 = ارتداد ظاهر (تجنّبه إلا لعناصر صغيرة جداً).

## المقادير المرجعية

| الحركة | من → إلى | المدة |
|---|---|---|
| ضغط زر صغير | scale 0.86×0.9 | 0.1s ضغط / 0.5s رجوع |
| ضغط بطاقة كبيرة | scale 0.98 | 0.1s / 0.5s |
| قفزة قيمة تغيّرت | 1 → 1.18 → 1 | 0.5s |
| ظهور نقطة/شارة | 0 → 1 | 0.45s |
| ظهور نافذة (modal) | 0.9 → 1 + شفافية | 0.45s |
| قائمة / popover | zoom من 0.9 | 0.35s |
| أيقونة فارغة (empty state) | 0.9 → 1 | 0.6s |
| رسالة خطأ | تنزل 4px | 0.45s |
| لوحة تبويب | تصعد 6px | 0.5s ES |
| عنصر مختار (باقة) | يرتفع 2px | 0.6s |
| صورة جديدة تحمّلت | 0.97 → 1 | 0.6s |
| يوم في التقويم تبدّل | 0.8 → 1 | 0.45s |

## CSS جاهز للنسخ

استخدم خصائص `scale` و`translate` المنفصلة (لا `transform`) حتى لا تتعارض مع transforms أخرى على العنصر. ضع هذا خارج طبقات Tailwind (unlayered) ليغلبها.

```css
:root {
  --ease-elastic: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-elastic-soft: cubic-bezier(0.34, 1.3, 0.64, 1);
  --ease-back-in: cubic-bezier(0.36, 0, 0.66, -0.56);
}

/* ضغط */
.elastic-press { transition: scale 0.5s var(--ease-elastic), background-color 0.15s ease; }
.elastic-press:active { scale: 0.86 0.9; transition-duration: 0.1s, 0.15s; }
.elastic-press-soft { transition: scale 0.5s var(--ease-elastic); }
.elastic-press-soft:active { scale: 0.98; transition-duration: 0.1s; }

/* قيمة تغيّرت (أعد المفتاح key عند التغيّر) */
.elastic-bump { display: inline-block; animation: elastic-bump 0.5s var(--ease-elastic); }
@keyframes elastic-bump { 0% { scale: 1; } 35% { scale: 1.18; } 100% { scale: 1; } }

/* نقطة / شارة تظهر */
.elastic-dot { animation: elastic-dot 0.45s var(--ease-elastic); }
@keyframes elastic-dot { from { scale: 0; } to { scale: 1; } }

/* نافذة */
.elastic-modal { animation: modal-in 0.45s var(--ease-elastic); }
@keyframes modal-in { from { scale: 0.9; opacity: 0; } to { scale: 1; opacity: 1; } }

/* وصول هادئ */
.settle-in { animation: settle-in 0.6s var(--ease-elastic) both; }
@keyframes settle-in { from { scale: 0.9; opacity: 0; } to { scale: 1; opacity: 1; } }
.rise-in { animation: rise-in 0.5s var(--ease-elastic-soft) both; }
@keyframes rise-in { from { translate: 0 6px; opacity: 0; } to { translate: 0 0; opacity: 1; } }

/* رسائل الخطأ */
[role="alert"] { animation: alert-in 0.45s var(--ease-elastic) both; }
@keyframes alert-in { from { translate: 0 -4px; opacity: 0; } to { translate: 0 0; opacity: 1; } }

/* عنصر مختار */
.is-picked { translate: 0 -2px; transition: translate 0.6s var(--ease-elastic), box-shadow 0.3s ease; }

/* صورة تحمّلت */
.img-settle { animation: img-settle 0.6s var(--ease-elastic); }
@keyframes img-settle { from { scale: 0.97; } to { scale: 1; } }

/* نقطة "غير مقروء" تنكمش */
.dot-read { transition: scale 0.45s var(--ease-back-in), opacity 0.45s ease; }

/* حقول النص: حلقة التركيز تنتفخ قليلاً */
input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), textarea, select {
  transition: box-shadow 0.4s var(--ease-elastic), border-color 0.2s ease;
}

/* checkbox / radio عند التفعيل */
input[type="checkbox"]:checked:focus, input[type="radio"]:checked:focus { animation: check-pop 0.45s var(--ease-elastic); }
@keyframes check-pop { 0% { scale: 0.6; } 60% { scale: 1.2; } 100% { scale: 1; } }

@media (prefers-reduced-motion: reduce) {
  .elastic-press, .elastic-press:active, .elastic-press-soft, .elastic-press-soft:active,
  .is-picked, .dot-read { transition: none; scale: none; translate: none; }
  .elastic-bump, .elastic-dot, .elastic-modal, .settle-in, .rise-in, [role="alert"],
  .img-settle, input:checked { animation: none; }
}
```

## Switch مرن (toggle)

الإبهام ينزلق بتجاوز، يتمدّد أفقياً أثناء الضغط، وينضغط لحظة الوصول. يعمل في RTL عبر `--dir`.

```css
.elastic-track { --pad: 2px; --size: calc(var(--h) - 2 * var(--pad)); position: relative; display: inline-block;
  width: var(--w); height: var(--h); border-radius: 9999px; transition: background-color 0.25s ease; }
.elastic-thumb { --dir: 1; position: absolute; top: var(--pad); inset-inline-start: var(--pad);
  width: var(--size); height: var(--size); border-radius: 9999px; transform-origin: left center;
  transition: translate 0.5s var(--ease-elastic), scale 0.4s var(--ease-elastic); }
[dir="rtl"] .elastic-thumb { --dir: -1; transform-origin: right center; }
.elastic-track[data-on="true"] .elastic-thumb {
  translate: calc((var(--w) - var(--size) - 2 * var(--pad)) * var(--dir)) 0; transform-origin: right center; }
[dir="rtl"] .elastic-track[data-on="true"] .elastic-thumb { transform-origin: left center; }
button:active .elastic-thumb { scale: 1.3 0.88; transition-duration: 0.5s, 0.12s; }
/* data-landed يُضاف فقط بعد نقرة حقيقية، حتى لا تتحرك عند التحميل */
.elastic-track[data-landed][data-on="true"] .elastic-thumb { animation: land-a 0.55s ease-out; }
.elastic-track[data-landed][data-on="false"] .elastic-thumb { animation: land-b 0.55s ease-out; }
@keyframes land-a { 0%, 30% { scale: 1; } 50% { scale: 0.8 1.12; } 75% { scale: 1.06 0.96; } 100% { scale: 1; } }
@keyframes land-b { 0%, 30% { scale: 1; } 50% { scale: 0.8 1.12; } 75% { scale: 1.06 0.96; } 100% { scale: 1; } }
```

```tsx
<button role="switch" aria-checked={on} onClick={() => { setOn(!on); setLanded(true); }}>
  <span className="elastic-track" style={{ "--w": "44px", "--h": "24px" } as React.CSSProperties}
        data-on={on} data-landed={landed || undefined}>
    <span className="elastic-thumb bg-white" />
  </span>
</button>
```

## أنماط React

**إعادة تشغيل الحركة عند تغيّر قيمة:** غيّر `key`.

```tsx
<span key={count} className="elastic-bump">{count}</span>
```

**ظهور/اختفاء زر صغير:**

```tsx
<AnimatePresence>
  {q && (
    <motion.button
      initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 24, opacity: { duration: 0.15 } }} />
  )}
</AnimatePresence>
```

**spring للموضع، ease للشفافية:**

```tsx
transition={{ opacity: { duration: 0.2 }, y: { type: "spring", stiffness: 380, damping: 26 } }}
```

**عدّاد أرقام:** التجاوز فقط للأعداد الصحيحة الكبيرة (≥ 20). التقييمات العشرية تبقى ease عادي حتى لا تظهر 4.9 كأنها 5.0. قصّ القيم السالبة بـ `Math.max(0, …)`.

**Radix / shadcn (tw-animate-css):** استبدل `zoom-in-95` بـ:

```
data-[state=open]:zoom-in-90 data-[state=open]:duration-[450ms] data-[state=open]:ease-[cubic-bezier(0.34,1.56,0.64,1)]
```

واحذف `slide-in-from-*` في حالة الفتح، لأنها تقفز مع التجاوز. للقوائم والـ popover استخدم 350ms.

**صورة تحمّلت:** صفّر `loaded` عند تغيّر الرابط، وأضف `img-settle` فقط بعد `onLoad`.

## أين نطبّقها (قائمة فحص لأي مشروع)

1. أزرار الأيقونات الصغيرة: `elastic-press`.
2. البطاقات الكبيرة والشعار: `elastic-press-soft`.
3. شارات العدد (إشعارات، رسائل، فلاتر): `key` + `elastic-dot`.
4. عدّادات تتغيّر (مفضلة، نسبة اكتمال، عدد أحرف قرب الحد): `key` + `elastic-bump`.
5. Switches: المكوّن المرن أعلاه.
6. النوافذ والقوائم والـ tooltips: zoom من 0.9 بمنحنى EB.
7. مؤشر "تم الحفظ": spring ظهور + أيقونة الصح.
8. التبويبات: المحتوى يصعد 6px بـ spring.
9. الحالات الفارغة: `settle-in` على الأيقونة.
10. رسائل الأخطاء: تنزل 4px.
11. شارات الفلاتر: spring ظهور، والباقي ينزاح بـ `layout`.
12. زر مسح البحث ✕: ينبثق من 0.5.
13. التقويم: الأسابيع تنزلق بتجاوز عند تغيير الشهر، واليوم المبدّل ينبض من 0.8.
14. نقطة "غير مقروء": تنكمش بـ back-in بدل أن تختفي فجأة.
15. الصور المرفوعة: تستقر من 0.97.

## ما لا نطبّقه

- أي شيء مرتبط بحركة الماوس (follow، tilt، magnetic، custom cursor).
- حركة في حلقة دائمة أو تلقائية بدون سبب.
- تجاوز على الشفافية أو اللون.
- ارتداد واضح على عناصر كبيرة (أقسام، صفحات كاملة).
- نجوم، لمعان، confetti كثيف، glitch، typewriter، flip ثلاثي الأبعاد.
- أكثر من حركة واحدة على نفس العنصر في نفس اللحظة.

## الفحص

- افحص في المتصفح والنافذة في **المقدمة**. النوافذ في الخلفية تبطئ `requestAnimationFrame` إلى 1–4 إطارات في الثانية، فتبدو النتائج خاطئة.
- مقياس سريع داخل الصفحة: سجّل `getComputedStyle(el).scale` كل إطار. الهدف 60+ fps وأطول فاصل بين إطارين أقل من 25ms، والقيمة تتجاوز ثم تستقر (مثلاً 0.5 → 1.068 → 1).
- جرّب RTL و LTR، وفعّل Reduce motion في النظام وتأكد أن كل شيء يتوقف.
