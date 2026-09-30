import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GeminiKeysForm } from "../gemini-keys-form";
import { AiProvidersForm } from "./ai-providers-form";
import { Sparkles, ArrowRight, KeyRound, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "إعدادات الذكاء الاصطناعي — أبو الأكبر",
};

export default async function AiSettingsPage() {
  const [keys, providerKeys] = await Promise.all([
    prisma.geminiApiKey.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.aIConfig.findMany({
      where: { provider: { in: ["gemini", "openai", "deepseek", "groq"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, provider: true, apiKey: true, label: true, isActive: true },
    }),
  ]);
  const aiAgentProviders = providerKeys.map((item) => ({
    id: item.id,
    provider: item.provider as "gemini" | "openai" | "deepseek" | "groq",
    label: item.label,
    maskedKey: item.apiKey.length > 8
      ? `${item.apiKey.slice(0, 4)}...${item.apiKey.slice(-4)}`
      : "••••••••",
    isActive: item.isActive,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      {/* الشريط العلوي */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/abo1stor3hlaa2kbr8-47/settings"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            title="رجوع للإعدادات"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              إعدادات الذكاء الاصطناعي
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              اختر مزود الذكاء الذي يستخدمه الوكيل للوصول الآمن إلى بيانات النظام
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          مجمع المفاتيح الفعال
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="mb-4 text-sm font-black text-slate-900">مزودات الوكيل الذكي</h2>
        <AiProvidersForm initialProviders={aiAgentProviders} />
      </div>

      {/* تنبيه وشرح سريع */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs sm:text-sm leading-relaxed space-y-1">
        <p className="font-bold flex items-center gap-1.5">
          <KeyRound className="w-4 h-4 text-amber-600" />
          كيف تحصل على المفاتيح؟
        </p>
        <p className="text-amber-800 text-xs">
          تستطيع الحصول على مفاتيح مجانية وسريعة من موقع{" "}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline text-indigo-700 hover:text-indigo-900"
          >
            Google AI Studio (اضغط هنا للفتح)
          </a>
          . يمكنك إضافة مفتاح واحد أو عدة مفاتيح، وسيقوم النظام بتدويرها تلقائياً لضمان عدم توقف الذكاء الاصطناعي نهائياً!
        </p>
      </div>

      <h2 className="text-sm font-black text-slate-900">مفاتيح Gemini الاحتياطية</h2>
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <GeminiKeysForm initialKeys={keys} />
      </div>
    </div>
  );
}
