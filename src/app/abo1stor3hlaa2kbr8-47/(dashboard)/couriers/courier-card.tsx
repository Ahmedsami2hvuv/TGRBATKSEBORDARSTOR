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
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        {/* بيانات المندوب الأساسية */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 truncate">
              {courier.name}
            </h3>
            {courier.hiddenFromReports ? (
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/30">
                مخفي
              </span>
            ) : courier.hasActivity ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                نشط ({courier.totalActivities})
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-500/20">
                بدون حركات
              </span>
            )}

            {courier.blocked && (
              <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20">
                محظور
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums mt-0.5 flex items-center gap-1">
            <DynamicIcon config={icons} iconKey="ui_phone" fallback="📞" className="w-3 h-3 opacity-70" />
            {courier.phone}
          </p>
        </div>

        {/* شريط الأزرار المصاحبة في سطر واحد أفقي مرتب */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 w-full sm:w-auto justify-end">
          {/* زر الواتساب */}
          <a
            href={whatsappAppUrl(courier.phone, shareText)}
            title="واتساب: مشاركة رابط لوحة المندوب"
            aria-label="واتساب: مشاركة رابط لوحة المندوب"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95"
          >
            <DynamicIcon config={icons} iconKey="ui_whatsapp" fallback="💬" className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </a>

          {/* زر معاينة اللوحة */}
          <a
            href={mandoubUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="معاينة لوحة المندوب"
            aria-label="معاينة لوحة المندوب"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-all active:scale-95"
          >
            <DynamicIcon config={icons} iconKey="ui_external_link" fallback="↗" className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </a>

          {/* زر تفعيل/تعطيل الدردشة */}
          <CourierChatToggle courierId={courier.id} initialDisabled={courier.chatDisabled} icons={icons} />

          {/* زر الإخفاء/الإظهار من قوائم الإسناد */}
          <CourierHideToggle courierId={courier.id} initialHidden={courier.hiddenFromReports} icons={icons} />

          {/* زر تصفير الأرقام */}
          <CourierResetButton courierId={courier.id} icons={icons} />

          {/* زر التعديل */}
          <Link
            href={`${secretAdminPath}/couriers/${courier.id}/edit`}
            title="تعديل بيانات المندوب"
            aria-label="تعديل بيانات المندوب"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm transition-all active:scale-95"
          >
            <DynamicIcon config={icons} iconKey="ui_edit" fallback="✏️" className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </Link>

          {/* زر الحذف */}
          <CourierDeleteForm id={courier.id} name={courier.name} icons={icons} />
        </div>
      </div>
    </div>
  );
}
