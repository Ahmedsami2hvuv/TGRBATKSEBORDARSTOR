import Link from "next/link";

export const metadata = {
  title: "إنشاء حساب — أبو الأكبر للتوصيل",
};

export default function RegisterPage() {
  return (
    <div className="kse-app-bg flex min-h-screen flex-col">
      <div className="kse-app-inner flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="kse-glass-card max-w-md p-8 text-center">
          <h1 className="text-xl font-extrabold text-slate-900">إنشاء حساب</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            التسجيل الذاتي غير مفعّل حالياً. يتم منح صلاحية الدخول إلى لوحة الإدارة من قبل
            الإدارة أو عبر ضبط الخادم.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            لطلب حساب أو صلاحيات جديدة، تواصل مع الإدارة مباشرة.
          </p>
          <p className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/admin/login"
              className="inline-flex justify-center rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:from-sky-700 hover:to-cyan-700"
            >
              تسجيل الدخول
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
