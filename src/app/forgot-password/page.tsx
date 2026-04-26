import Link from "next/link";

export const metadata = {
  title: "نسيت الرمز — أبو الأكبر للتوصيل",
};

export default function ForgotPasswordPage() {
  return (
    <div className="kse-app-bg flex min-h-screen flex-col">
      <div className="kse-app-inner flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="kse-glass-card max-w-md p-8 text-center">
          <h1 className="text-xl font-extrabold text-slate-900">نسيت الرمز؟</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            لوحة الإدارة تستخدم كلمة مرور واحدة تُضبط على الخادم. لا يمكن استعادتها تلقائياً
            من الموقع.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            تواصل مع <strong className="text-slate-800">مسؤول النظام</strong> لإعادة ضبط كلمة
            المرور أو تحديث المتغير <code className="rounded bg-slate-100 px-1 text-xs">ADMIN_PASSWORD</code>{" "}
            في إعدادات الاستضافة.
          </p>
          <p className="mt-8">
            <Link
              href="/admin/login"
              className="inline-flex rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:from-sky-700 hover:to-cyan-700"
            >
              العودة لتسجيل الدخول
            </Link>
          </p>
          <p className="mt-6">
            <Link href="/" className="text-sm font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900">
              ← الرئيسية
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
