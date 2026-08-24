import Link from "next/link";
import { buildCourierShareMessage, whatsappAppUrl } from "@/lib/whatsapp";
import { CourierChatToggle } from "./courier-chat-toggle";
import { CourierHideToggle } from "./courier-hide-toggle";
import { CourierResetButton } from "./courier-reset-button";
import { CourierDeleteForm } from "./courier-delete-form";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

interface CourierCardProps {
  courier: any;
  mandoubUrl: string;
  icons: GlobalIconsConfig;
  secretAdminPath: string;
}

export function CourierCard({
  courier,
  mandoubUrl,
  icons,
  secretAdminPath,
}: CourierCardProps) {
  const shareText = buildCourierShareMessage({
    courierName: courier.name,
    delegatePortalUrl: mandoubUrl,
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all space-y-4">
      {/* الترويسة والمعلومات الإدارية */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
              {courier.name}
            </h3>
            {courier.hiddenFromReports ? (
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/30">
                مخفي من الإسناد
              </span>
            ) : courier.hasActivity ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                نشط ({courier.totalActivities} حركة)
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-500/20">
                بدون حركات
              </span>
            )}

            {courier.blocked && (
              <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20">
                محظور
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 tabular-nums mt-1 flex items-center gap-1.5">
            <DynamicIcon config={icons} iconKey="ui_phone" fallback="📞" className="w-3.5 h-3.5 opacity-70" />
            {courier.phone}
          </p>
        </div>

        {/* أزرار التعديل والحذف السريعة في ترويسة البطاقة */}
        <div className="flex items-center gap-2">
          <Link
            href={`${secretAdminPath}/couriers/${courier.id}/edit`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <DynamicIcon config={icons} iconKey="ui_edit" fallback="✏️" className="w-3.5 h-3.5 text-slate-500" />
            <span>تعديل</span>
          </Link>
          <CourierDeleteForm id={courier.id} name={courier.name} icons={icons} />
        </div>
      </div>

      {/* شريط الأزرار المصاحبة للمندوب منظم ومستجيب */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2.5 items-center">
        {/* زر الواتساب */}
        <a
          href={whatsappAppUrl(courier.phone, shareText)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3.5 py-2 text-xs font-bold shadow-sm transition-all"
        >
          <DynamicIcon config={icons} iconKey="ui_whatsapp" fallback="💬" className="w-4 h-4" />
          <span>واتساب: رابط لوحة المندوب</span>
        </a>

        {/* زر معاينة اللوحة */}
        <a
          href={mandoubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white px-3.5 py-2 text-xs font-bold shadow-sm transition-all"
        >
          <DynamicIcon config={icons} iconKey="ui_external_link" fallback="↗" className="w-4 h-4" />
          <span>معاينة اللوحة</span>
        </a>

        {/* زر تفعيل/تعطيل الدردشة */}
        <CourierChatToggle courierId={courier.id} initialDisabled={courier.chatDisabled} icons={icons} />

        {/* زر الإخفاء/الإظهار من قوائم الإسناد */}
        <CourierHideToggle courierId={courier.id} initialHidden={courier.hiddenFromReports} icons={icons} />

        {/* زر تصفير الأرقام */}
        <CourierResetButton courierId={courier.id} icons={icons} />
      </div>
    </div>
  );
}
