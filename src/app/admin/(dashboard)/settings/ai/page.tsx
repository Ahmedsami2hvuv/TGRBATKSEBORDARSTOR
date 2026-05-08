import { prisma } from "@/lib/prisma";
import AIConfigClient from "./ai-config-client";
import { getAIPortalTrainingConfig, syncDatabaseSchema } from "./actions";

export const dynamic = "force-dynamic";

export default async function AISettingsPage() {
  try {
    // محاولة جلب الإعدادات من الموديل الجديد
    const aiConfigs = await prisma.aIConfig.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const trainingConfig = await getAIPortalTrainingConfig();

    return (
      <div className="p-6 max-w-4xl mx-auto font-cairo">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">إعدادات الذكاء الصناعي 🤖</h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold mt-2">
            قم بإدارة مفاتيح الـ API لـ Gemini و ChatGPT و Groq لزيادة حصة الاستخدام اليومية.
          </p>
        </div>

        <AIConfigClient initialConfigs={aiConfigs} initialTrainingConfig={trainingConfig} />
      </div>
    );
  } catch (error) {
    console.error("AI Settings Page Error:", error);

    // في حال وجود خطأ (غالباً بسبب عدم وجود الجدول)، سنعرض واجهة المزامنة
    return (
      <div className="p-10 text-center max-w-2xl mx-auto">
        <div className="bg-rose-50 p-8 rounded-[3rem] border-2 border-rose-100 shadow-xl">
          <div className="text-6xl mb-4">⚙️</div>
          <h2 className="text-2xl font-black text-rose-600">تحديث مطلوب لقاعدة البيانات</h2>
          <p className="mt-4 text-slate-600 font-bold">
            يبدو أنك قمت بتحديث النظام ولكن قاعدة البيانات لا تزال تعمل بالإصدار القديم.
            اضغط على الزر أدناه لمزامنة الجداول الجديدة تلقائياً.
          </p>

          <SyncButton />
        </div>
      </div>
    );
  }
}

// مكون صغير للزر لتجنب تحويل الصفحة بالكامل لـ Client Component
function SyncButton() {
  return (
    <form action={async () => {
      "use server";
      await syncDatabaseSchema();
    }}>
      <button
        type="submit"
        className="mt-8 bg-rose-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-rose-700 transition shadow-lg shadow-rose-200"
      >
        تحديث ومزامنة قاعدة البيانات الآن 🚀
      </button>
    </form>
  );
}
