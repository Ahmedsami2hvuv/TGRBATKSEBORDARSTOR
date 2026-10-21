import { getPartners } from "./actions";
import { CreditBookClient } from "./credit-book-client";
import { getCurrentSessionIsAccountant } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function CreditBookPage() {
  const [initialPartners, isAccountant] = await Promise.all([
    getPartners(),
    getCurrentSessionIsAccountant(),
  ]);

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f7fb] px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-[1440px] space-y-5">
        <header className="relative overflow-hidden rounded-[24px] bg-[#102746] px-5 py-6 text-white shadow-[0_12px_32px_rgba(16,39,70,0.12)] sm:px-8 sm:py-7">
          <div className="absolute -left-10 -top-16 h-52 w-52 rounded-full border border-white/10" />
          <div className="absolute -left-1 top-8 h-32 w-32 rounded-full border border-white/10" />
          <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-100">
                <span className="h-2 w-2 rounded-full bg-[#72c3ff]" />
                الحسابات والمستحقات
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">دفتر الديون</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100/80">
                متابعة أرصدة المناديب والمجهزين والمحلات والزبائن من مكان واحد.
              </p>
            </div>
            <div className="flex items-center gap-3 self-start rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 sm:self-auto">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#72c3ff]/15 text-[#9bd5ff]">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 3.75h8.25L19 8.5v11.75A1.75 1.75 0 0 1 17.25 22h-10.5A1.75 1.75 0 0 1 5 20.25V5.5A1.75 1.75 0 0 1 6.75 3.75Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 4v5h5M8 13h8M8 17h8" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-extrabold">إدارة مالية موحدة</div>
                <div className="mt-1 text-xs text-blue-100/70">عرض الحسابات وتفاصيل الأرصدة</div>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-[22px] border border-[#e4eaf2] bg-white p-2 shadow-[0_5px_20px_rgba(15,39,70,0.035)] sm:p-4">
          <CreditBookClient initialPartners={initialPartners} isAccountant={isAccountant} />
        </section>
        <footer className="px-1 text-center text-[11px] font-medium text-slate-400">
          دفتر الديون · جميع الأرصدة المعروضة مرتبطة بحسابات النظام
        </footer>
      </div>
    </main>
  );
}
