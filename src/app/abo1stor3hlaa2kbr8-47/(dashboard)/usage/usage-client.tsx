"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { type VercelUsageReport, type VercelUsageConfig } from "@/lib/vercel-usage";
import { updateVercelConfigAction, refreshUsageAction } from "./actions";

interface UsageClientProps {
  initialReport: VercelUsageReport;
  initialConfig: VercelUsageConfig;
}

export function UsageClient({ initialReport, initialConfig }: UsageClientProps) {
  const [report, setReport] = useState<VercelUsageReport>(initialReport);
  const [config, setConfig] = useState<VercelUsageConfig>(initialConfig);
  const [activeTab, setActiveTab] = useState<"overview" | "breakdown" | "settings">("overview");

  // نموذج الإعدادات
  const [tokenInput, setTokenInput] = useState(config.vercelToken);
  const [projectIdInput, setProjectIdInput] = useState(config.projectId || "");
  const [teamIdInput, setTeamIdInput] = useState(config.teamId || "");
  const [planInput, setPlanInput] = useState<"hobby" | "pro">(config.plan === "pro" ? "pro" : "hobby");

  const [isPending, startTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(null);
    setSaveError(null);

    startTransition(async () => {
      const res = await updateVercelConfigAction({
        vercelToken: tokenInput,
        projectId: projectIdInput,
        teamId: teamIdInput,
        plan: planInput,
      });

      if (res.ok) {
        setSaveSuccess("تم حفظ إعدادات فيرسل بنجاح! جاري فحص وتحديث الاستهلاك...");
        const refreshRes = await refreshUsageAction();
        if (refreshRes.ok && refreshRes.report) {
          setReport(refreshRes.report);
          setSaveSuccess("تم حفظ الإعدادات وتحديث بيانات الاستهلاك بنجاح ✅");
        }
      } else {
        setSaveError(res.error || "حدث خطأ أثناء الحفظ");
      }
    });
  };

  const handleManualRefresh = () => {
    setSaveSuccess(null);
    setSaveError(null);
    startTransition(async () => {
      const res = await refreshUsageAction();
      if (res.ok && res.report) {
        setReport(res.report);
      } else {
        setSaveError(res.error || "تعذر تحديث البيانات");
      }
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* الترويسة الرئيسية */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-[#0c221b]/90 p-5 sm:p-6 rounded-2xl border-2 border-[#C9A86A]/40 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl sm:text-3xl">⚡</span>
            <h1 className="text-xl sm:text-2xl font-black text-[#0A3D2E] dark:text-[#F5D77F]">
              متابعة الاستخدام واستهلاك فيرسل
            </h1>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            راقب استهلاك موارد السيرفر، نقل البيانات، ودوال البناء واعرف على شنو دينصرف الاستهلاك بالتفصيل.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-sm transition disabled:opacity-50"
          >
            <span className={isPending ? "animate-spin" : ""}>🔄</span>
            {isPending ? "جاري التحديث..." : "تحديث الاستهلاك"}
          </button>

          <a
            href="https://vercel.com/dashboard/usage"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-[#0F4D3A] hover:bg-[#0A3D2E] text-[#F5D77F] border border-[#C9A86A]/60 shadow-sm transition active:scale-95"
          >
            <span>↗</span>
            فتح حساب فيرسل الرسمي
          </a>
        </div>
      </div>

      {/* تنبيه حالة الاتصال */}
      {report.errorMessage && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div className="flex-1">{report.errorMessage}</div>
        </div>
      )}

      {/* بطاقة معلومات الحساب السريعة */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#0c221b]/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">نوع الباقة</span>
          <span className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-400 mt-1 block">
            {report.plan}
          </span>
        </div>

        <div className="bg-white dark:bg-[#0c221b]/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">حالة الربط</span>
          <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
            <span className={`w-2 h-2 rounded-full ${report.connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            {report.connected ? "مربوط عبر API" : "حساب تقديري ذكي"}
          </span>
        </div>

        <div className="bg-white dark:bg-[#0c221b]/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">طلبات هذا الشهر</span>
          <span className="text-sm sm:text-base font-black text-slate-800 dark:text-[#F5D77F] mt-1 block">
            {report.localStats.ordersThisMonth.toLocaleString()} طلب
          </span>
        </div>

        <div className="bg-white dark:bg-[#0c221b]/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">مخزن الصور</span>
          <span className="text-xs sm:text-sm font-bold text-sky-700 dark:text-sky-400 mt-1 block">
            Cloudflare R2 (معزول)
          </span>
        </div>
      </div>

      {/* أزرار التبديل بين التبويبات */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm rounded-t-xl transition-all whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-[#0F4D3A] text-[#F5D77F] border-b-2 border-[#C9A86A]"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
          }`}
        >
          📊 نظرة عامة على الاستهلاك
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("breakdown")}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm rounded-t-xl transition-all whitespace-nowrap ${
            activeTab === "breakdown"
              ? "bg-[#0F4D3A] text-[#F5D77F] border-b-2 border-[#C9A86A]"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
          }`}
        >
          🔍 على شنو دينصرف الاستهلاك؟
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm rounded-t-xl transition-all whitespace-nowrap ${
            activeTab === "settings"
              ? "bg-[#0F4D3A] text-[#F5D77F] border-b-2 border-[#C9A86A]"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
          }`}
        >
          ⚙️ إعدادات ربط توكن فيرسل
        </button>
      </div>

      {/* محتوى تبويب: نظرة عامة */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.metrics.map((item) => {
              const isDanger = item.percentage >= 80;
              const isWarning = item.percentage >= 50 && item.percentage < 80;
              const barColor = isDanger
                ? "bg-rose-500"
                : isWarning
                ? "bg-amber-500"
                : "bg-emerald-500";

              return (
                <div
                  key={item.id}
                  className="bg-white dark:bg-[#0c221b]/80 border-2 border-[#C9A86A]/30 rounded-2xl p-5 shadow-xs transition hover:border-[#C9A86A] space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {item.category}
                      </span>
                      <h3 className="font-black text-base sm:text-lg text-slate-800 dark:text-white mt-1">
                        {item.name}
                      </h3>
                    </div>

                    <div className="text-left">
                      <span className="text-xl sm:text-2xl font-black text-[#0F4D3A] dark:text-[#F5D77F]">
                        {item.percentage}%
                      </span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">من الحد المتاح</span>
                    </div>
                  </div>

                  {/* شريط التقدم */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.max(2, Math.min(100, item.percentage))}%` }}
                    />
                  </div>

                  {/* الأرقام المستهلكة والحد الأقصى */}
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pt-1">
                    <span>
                      المستهلك: <strong className="text-emerald-700 dark:text-emerald-400">{item.formattedUsed}</strong>
                    </span>
                    <span>
                      الحد المسموح: <strong className="text-slate-600 dark:text-slate-400">{item.formattedLimit}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-800/60">
                    {item.description}
                  </p>

                  <div className="text-[11px] bg-slate-50 dark:bg-[#12362a] p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                    <span className="text-emerald-600 font-bold shrink-0">💡 نصيحة:</span>
                    <span>{item.tips}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* بطاقة توضيحية حول حماية الاستهلاك */}
          <div className="bg-gradient-to-r from-emerald-900 to-[#0F4D3A] text-white p-5 sm:p-6 rounded-2xl shadow-md space-y-3 border border-[#C9A86A]">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛡️</span>
              <h3 className="text-base sm:text-lg font-bold text-[#F5D77F]">
                كيف يحمي نظام متجرك استهلاك فيرسل من النفاد؟
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
              تم بناء هيكلية الموقع بعناية فائقة لتفادي الوصول إلى حدود فيرسل المدفوعة: الصور الكبيرة تُرفع مباشرة إلى خوادم <strong>Cloudflare R2</strong> المستقلة دون المرور بسيرفر فيرسل، مما يمنع استهلاك الباندويث المحدود. كما تم تفعيل التخزين المؤقت للبيانات والاستعلامات السريعة.
            </p>
          </div>
        </div>
      )}

      {/* محتوى تبويب: على شنو دينصرف */}
      {activeTab === "breakdown" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#0c221b]/90 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-base sm:text-lg font-black text-[#0A3D2E] dark:text-[#F5D77F] mb-1">
              تفصيل بنود الصرف والاستهلاك في النظام
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              هنا تجد شرحاً مبسطاً عن كل عملية يقوم بها النظام وأثرها على استهلاك السيرفر وفيرسل.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {report.breakdown.map((item, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-[#0c221b]/80 border-2 border-[#C9A86A]/30 rounded-2xl p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-base sm:text-lg text-slate-800 dark:text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C9A86A]" />
                    {item.title}
                  </h3>
                  <span
                    className={`text-[11px] font-black px-2.5 py-1 rounded-full ${
                      item.impact === "high"
                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                        : item.impact === "medium"
                        ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                        : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    }`}
                  >
                    مستوى التأثير: {item.impact === "high" ? "عالي" : item.impact === "medium" ? "متوسط" : "منخفض"}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.description}
                </p>

                {item.systemStat && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800">
                    📈 حالة النظام الحالية: <span className="font-normal">{item.systemStat}</span>
                  </div>
                )}

                <div className="bg-[#FFF8F0] dark:bg-[#12362a] p-3 rounded-xl border border-[#C9A86A]/40 text-xs text-[#0A3D2E] dark:text-[#F5D77F] flex items-start gap-2">
                  <span className="text-base shrink-0">💡</span>
                  <div>
                    <strong className="block font-bold mb-0.5">كيف تقلل هذا الاستهلاك وتحافظ عليه آمناً:</strong>
                    <span className="leading-relaxed opacity-90">{item.howToReduce}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* محتوى تبويب: إعدادات فيرسل والتوكن */}
      {activeTab === "settings" && (
        <div className="bg-white dark:bg-[#0c221b]/90 border-2 border-[#C9A86A]/40 rounded-2xl p-5 sm:p-7 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-black text-[#0A3D2E] dark:text-[#F5D77F]">
              إعدادات ربط حساب فيرسل (Vercel API Integration)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
              إذا أردت مزامنة الأرقام الحية الدقيقة مباشرة من لوحة حساب فيرسل، أدخل الـ Token الخاص بك هنا.
            </p>
          </div>

          {saveSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm font-bold flex items-center gap-2">
              <span>✅</span>
              <span>{saveSuccess}</span>
            </div>
          )}

          {saveError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-rose-800 dark:text-rose-200 text-xs sm:text-sm font-bold flex items-center gap-2">
              <span>❌</span>
              <span>{saveError}</span>
            </div>
          )}

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                توكن الوصول الخاص بفيرسل (Vercel Access Token)
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="مثال: Abc123xyz456..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                تستطيع إنشاء التوكن من: Vercel Dashboard &gt; Settings &gt; Tokens &gt; Create Token.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                  معرّف الفريق (Team ID) - اختياري
                </label>
                <input
                  type="text"
                  value={teamIdInput}
                  onChange={(e) => setTeamIdInput(e.target.value)}
                  placeholder="اتركه فارغاً إذا كان حسابك شخصي"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                  نوع الباقة في فيرسل
                </label>
                <select
                  value={planInput}
                  onChange={(e) => setPlanInput(e.target.value as "hobby" | "pro")}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="hobby">Hobby (المجانية - 100GB نقل بيانات و 100 ساعة دوال)</option>
                  <option value="pro">Pro (الاحترافية - 1TB نقل بيانات و 1000 ساعة دوال)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0F4D3A] to-[#0A3D2E] text-[#F5D77F] font-black text-sm border-2 border-[#C9A86A] shadow-md hover:brightness-110 active:scale-95 transition disabled:opacity-50"
              >
                {isPending ? "جاري الحفظ والفحص..." : "حفظ الإعدادات وتحديث الاستهلاك"}
              </button>
            </div>
          </form>

          {/* خطوات إرشادية واضحة ومبسطة للمدير */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
              📌 خطوات استخراج التوكن من فيرسل خلال دقيقة واحدة:
            </h4>
            <ol className="text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside space-y-1 leading-relaxed">
              <li>سجل دخولك إلى حسابك في موقع فيرسل (vercel.com).</li>
              <li>اضغط على صورة حسابك في الزاوية العلوية ثم اختر <strong>Settings</strong>.</li>
              <li>من القائمة الجانبية في فيرسل اختر <strong>Tokens</strong>.</li>
              <li>اضغط على زر <strong>Create</strong> واكتب أي اسم (مثلاً: Wasli Store).</li>
              <li>انسخ الرمز الذي يظهر لك وضعه في الخانة بالأعلى ثم اضغط <strong>حفظ</strong>.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
