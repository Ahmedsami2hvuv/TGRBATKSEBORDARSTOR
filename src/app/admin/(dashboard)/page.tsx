import { testTelegramAction } from "./actions";
import { AdminHubDashboard } from "./admin-hub-dashboard";
import { AdminProfitsWidget } from "./admin-profits-widget";

export const metadata = {
  title: "لوحة الرئيسية — أبو الأكبر للتوصيل",
};

type Props = {
  searchParams?: Promise<{ tg?: string; reason?: string }>;
};

export default async function AdminHomePage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const telegramConfigured =
    Boolean(process.env.TELEGRAM_BOT_TOKEN) &&
    Boolean(process.env.TELEGRAM_GROUP_CHAT_ID);

  return (
    <div className="space-y-8">
      <AdminHubDashboard />

      <section className="kse-glass-dark rounded-[1.25rem] border border-sky-200 p-5 sm:p-6">
        <h2 className="text-sm font-bold text-sky-800">تيليجرام</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          تأكد من ضبط متغيرات البوت في Railway وأن البوت داخل المجموعة.
        </p>
        {!telegramConfigured ? (
          <p className="mt-2 text-sm text-amber-800/90">المتغيرات غير مكتملة بعد.</p>
        ) : null}
        {sp.tg === "ok" ? (
          <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            تم إرسال رسالة الاختبار إلى المجموعة.
          </div>
        ) : null}
        {sp.tg === "err" ? (
          <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
            فشل إرسال تيليجرام: {sp.reason ?? "خطأ غير معروف"}
          </div>
        ) : null}
        <form className="mt-4" action={testTelegramAction}>
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-200 ring-1 ring-sky-400/30 transition hover:from-sky-700 hover:to-cyan-700 active:scale-[0.99]"
          >
            إرسال رسالة تجريبية
          </button>
        </form>
      </section>

      <AdminProfitsWidget />
    </div>
  );
}
