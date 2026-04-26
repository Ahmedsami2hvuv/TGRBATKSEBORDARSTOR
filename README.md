# KSEBORDARSTOR

هيكل أولي: **Next.js (App Router)** + **Prisma** + **PostgreSQL**، جاهز للربط بـ [Railway](https://railway.app) و [GitHub](https://github.com).

## محلياً

1. انسخ البيئة: انسخ `.env.example` إلى `.env` واملأ `DATABASE_URL`.
2. ثبّت الحزم: `npm install`
3. طبّق المخطط: `npm run db:migrate` أو `npm run db:push`
4. شغّل التطوير: `npm run dev`

## Railway

1. أنشئ مشروعاً جديداً واختر **Deploy from GitHub** وحدد هذا المستودع.
2. أضف قاعدة بيانات **PostgreSQL** (خدمة منفصلة في نفس المشروع).
3. **اربط `DATABASE_URL` بخدمة التطبيق (مهم جداً):**
   - افتح خدمة **التطبيق** (ليست Postgres) → **Variables**.
   - **Add Variable** → **Reference** (أو اختر متغيراً من خدمة أخرى) → اختر خدمة **Postgres** → المتغير **`DATABASE_URL`**.
   - لا تترك قيمة وهمية مثل `postgresql://USER:...`؛ يجب أن تكون القيمة الحقيقية التي يولّدها Railway لـ Postgres.
4. **البناء:** `prisma generate` ثم `next build` (لا يحتاج اتصالاً بقاعدة البيانات أثناء البناء).
5. **التشغيل:** `prisma migrate deploy` ثم `next start` — الهجرات تُطبَّق عند بدء الحاوية عندما يكون `DATABASE_URL` متاحاً.
6. أضف متغيرات التشغيل (من `.env.example`):
   - `NEXT_PUBLIC_APP_URL` — رابط نشرك (مثل `https://....up.railway.app`).
   - `ADMIN_PASSWORD` — كلمة مرور دخول `/admin/login`.
   - `ADMIN_SESSION_SECRET` — نص عشوائي طويل (مثلاً 32+ حرفاً) لتوقيع جلسة الإدارة.
   - `TELEGRAM_BOT_TOKEN` — من BotFather (لا ترفعه للمستودع).
   - `TELEGRAM_GROUP_CHAT_ID` — معرف المجموعة؛ إن لزم استخدم الصيغة الكاملة `-100...`.
   - `TELEGRAM_BOT_USERNAME` — اختياري (بدون `@`) لعرضه في رسائل الاختبار.

## الإدارة والمناطق

- الصفحة الرئيسية: `/` — رابط «دخول لوحة الإدارة».
- تسجيل الدخول: `/admin/login`
- المناطق: `/admin/regions` — إضافة اسم المنطقة وسعر التوصيل، بحث، تعديل، حذف.
- المحلات: `/admin/shops` — اسم المحل، المنطقة، رابط اللوكيشن؛ بحث، تعديل، حذف، ورابط **الموظفون** لكل محل.
- موظفو المحل: `/admin/shops/[id]/employees` — إضافة موظف (اسم + هاتف)، بحث، تعديل، حذف، رابط **واتساب** تلقائي من الرقم.
- من لوحة الإدارة يمكن **إرسال رسالة تجريبية** إلى مجموعة التليجرام بعد ضبط التوكن ومعرف المجموعة.

إن ظهر تنبيه **اشتراك متأخر (past due)** في Railway، سدّد المستحقات حتى لا تتعطّل البناءات أو الخدمات.

بعد كل `git push`، Railway يعيد البناء والنشر تلقائياً إن كان الربط مفعّلاً.
