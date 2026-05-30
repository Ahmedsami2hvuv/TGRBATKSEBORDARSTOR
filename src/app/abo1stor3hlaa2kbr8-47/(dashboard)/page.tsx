import { testTelegramAction } from "./actions";
import { AdminHubDashboard } from "./admin-hub-dashboard";
import { AdminProfitsWidget } from "./admin-profits-widget";
import { AdminDebtsWidget } from "./admin-debts-widget";

import { serializePrisma } from "@/lib/serialize-prisma";

export const metadata = {
  title: "لوحة الرئيسية — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams?: Promise<{ tg?: string; reason?: string }>;
};

export default async function AdminHomePage({ searchParams }: Props) {
  const sp = serializePrisma((await searchParams) ?? {});
  const telegramConfigured =
    Boolean(process.env.TELEGRAM_BOT_TOKEN) &&
    Boolean(process.env.TELEGRAM_GROUP_CHAT_ID);

  return (
    <div className="space-y-12">
      <AdminHubDashboard />

      <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 11c-2.33 0-4.31-1.46-5.11-3.5 1.05-2.69 3.41-4.5 6.11-4.5s5.06 1.81 6.11 4.5c-.8 2.04-2.78 3.5-5.11 3.5z"/></svg>
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">إعدادات الإشعارات (تيليجرام)</h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-2xl">
          تأكد من ضبط متغيرات البوت في بيئة العمل وأن البوت مفعل داخل المجموعة الخاصة بالطلبات.
        </p>

        {!telegramConfigured ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/20 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-400">
             <span>⚠️ الإعدادات غير مكتملة في ملف .env</span>
          </div>
        ) : null}

        {sp.tg === "ok" ? (
          <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500/20 px-4 py-3 text-sm font-bold text-indigo-700 dark:text-indigo-400">
            ✅ تم إرسال رسالة الاختبار بنجاح.
          </div>
        ) : null}

        {sp.tg === "err" ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/20 px-4 py-3 text-sm font-bold text-rose-700 dark:text-rose-400">
            ❌ فشل الإرسال: {sp.reason ?? "خطأ غير معروف"}
          </div>
        ) : null}

        <form className="mt-8" action={testTelegramAction}>
          <button
            type="submit"
            className="rounded-2xl bg-indigo-600 px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 hover:shadow-indigo-500/40 active:scale-[0.98]"
          >
            إرسال رسالة تجريبية
          </button>
        </form>
      </section>

      <AdminProfitsWidget />
      <AdminDebtsWidget />
    </div>
  );
}
