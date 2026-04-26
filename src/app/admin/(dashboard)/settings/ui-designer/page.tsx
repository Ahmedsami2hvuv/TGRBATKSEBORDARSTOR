import { getUISettings } from "@/lib/ui-settings";
import { UIDesignerClient } from "./ui-designer-client";

export default async function UIDesignerPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string; section?: string }>;
}) {
  // في إصدارات Next.js الحديثة يجب عمل await للـ searchParams
  const sp = await searchParams;
  const target = sp.target || "admin";
  const section = sp.section || "order_card";

  const config = await getUISettings(target, section);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">مصمم الواجهات الذكي 🎨</h1>
        <p className="text-slate-500 mt-2 font-medium">تحكم في كل تفصيلة في الموقع، الألوان، الأماكن، والصور الخلفية.</p>
      </div>

      <UIDesignerClient
        initialTarget={target}
        initialSection={section}
        initialConfig={config || {}}
      />
    </div>
  );
}
