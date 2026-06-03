import { ad } from "@/lib/admin-ui";
import { getBackgroundsConfig } from "@/lib/background-settings";
import { BackgroundSettingsForm } from "../settings/background-settings-form";

export const metadata = {
  title: "إدارة الخلفيات الحية المتحركة — KSEBORDARSTOR",
};

export default async function BackgroundsManagementPage() {
  let backgroundsConfig;
  try {
    backgroundsConfig = await getBackgroundsConfig();
  } catch (error) {
    console.error("Failed to load backgrounds config page:", error);
    return (
      <div className="p-8 text-red-650 font-bold text-center">
        حدث خطأ أثناء تحميل إعدادات الخلفيات. يرجى التحقق من اتصال قاعدة البيانات.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className={ad.h1}>الخلفيات المتحركة الحية 🎆</h1>
        <p className={ad.lead}>
          إدارة الخلفيات الحركية والجمالية للموقع، وإمكانية تخصيصها للمناديب والمجهزين.
        </p>
      </div>

      <div className="bg-white dark:bg-[#09090b] rounded-[1.5rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <BackgroundSettingsForm initial={backgroundsConfig} />
      </div>
    </div>
  );
}
