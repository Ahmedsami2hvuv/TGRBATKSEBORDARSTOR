import { ad } from "@/lib/admin-ui";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "دخول الإدارة — وصلي",
};

export default function AdminLoginPage() {
  return (
    <div className="kse-app-bg flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="kse-app-inner w-full max-w-sm rounded-[1.75rem] border border-sky-200 bg-white p-8 shadow-xl shadow-sky-100/80 ring-1 ring-cyan-100/60 flex flex-col items-center">
        <img 
          src="/images/wasly-logo.png" 
          alt="وصلي" 
          className="w-20 h-20 object-contain mb-3 rounded-full shadow-md"
        />
        <p className={`text-center text-base font-extrabold text-[#0088ff]`}>
          وصلي
        </p>
        <h1 className="mt-1 text-center text-lg font-bold text-slate-800">لوحة الإدارة</h1>
        <p className={`mt-1 text-center ${ad.muted}`}>ادخل كلمة المرور</p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
