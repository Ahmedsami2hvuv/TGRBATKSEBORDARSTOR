"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import type { NotificationSoundPresetId } from "@/lib/notification-sound-presets";
import { NotificationSettingsForm } from "./notification-settings-form";
import { PurgeDemoDataForm } from "./purge-demo-data-form";
import { TestPushNotificationsForm } from "./test-push-notifications-form";
import { PricingSettingsForm } from "./pricing-settings-form";
import { CleanupBase64Form } from "./cleanup-base64-form";
import { IconSettingsForm } from "./icon-settings-form";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { WhatsappTemplateSettingsForm } from "./whatsapp-template-settings-form";
import { saveChatSettingsAction, saveRoleFeaturesAction, updateCourierButtonsAction } from "./actions";
import { useRouter } from "next/navigation";
import { RoleFeaturesConfig } from "@/lib/role-features-settings";
import { CourierButtonsSettings } from "./courier-buttons-settings";

type NotificationInitial = {
  adminEnabled: boolean;
  adminTitleSingle: string;
  adminTemplateSingle: string;
  adminTemplateMultiple: string;
  adminSoundEnabled: boolean;
  adminSoundPreset: NotificationSoundPresetId;
  mandoubEnabled: boolean;
  mandoubTitleSingle: string;
  mandoubTemplateSingle: string;
  mandoubTemplateMultiple: string;
  mandoubSoundEnabled: boolean;
  mandoubSoundPreset: NotificationSoundPresetId;
  preparerEnabled: boolean;
  preparerTitleSingle: string;
  preparerTemplateSingle: string;
  preparerTemplateMultiple: string;
  preparerTemplateWebsite: string;
  preparerSoundEnabled: boolean;
  preparerSoundPreset: NotificationSoundPresetId;
};

function ChevronIcon({ open, icons }: { open: boolean, icons: GlobalIconsConfig }) {
  return (
    <DynamicIcon
      iconKey="ui_arrow_right"
      config={icons}
      className={`h-5 w-5 transition duration-200 ${open ? "-rotate-90" : "rotate-90"}`}
      fallback={
        <svg
          className={`h-5 w-5 transition duration-200 ${open ? "rotate-180" : "rotate-0"}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.4}
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      }
    />
  );
}

function Block({
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
  icons,
  tone = "sky",
}: {
  id: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  icons: GlobalIconsConfig;
  tone?: "sky" | "emerald" | "amber" | "rose" | "indigo";
}) {
  const toneClasses = useMemo(() => {
    switch (tone) {
      case "emerald":
        return {
          border: "border-emerald-200/90",
          focus: "focus-visible:ring-emerald-300/60",
          badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
          hover: "hover:border-emerald-300 hover:shadow-emerald-200/40",
        };
      case "amber":
        return {
          border: "border-amber-200/90",
          focus: "focus-visible:ring-amber-300/60",
          badge: "bg-amber-50 text-amber-800 border-amber-200",
          hover: "hover:border-amber-300 hover:shadow-amber-200/40",
        };
      case "rose":
        return {
          border: "border-rose-200/90",
          focus: "focus-visible:ring-rose-300/60",
          badge: "bg-rose-50 text-rose-800 border-rose-200",
          hover: "hover:border-rose-300 hover:shadow-rose-200/40",
        };
      case "indigo":
        return {
          border: "border-indigo-200/90",
          focus: "focus-visible:ring-indigo-300/60",
          badge: "bg-indigo-50 text-indigo-800 border-indigo-200",
          hover: "hover:border-indigo-300 hover:shadow-indigo-200/40",
        };
      default:
        return {
          border: "border-sky-200/90",
          focus: "focus-visible:ring-sky-300/60",
          badge: "bg-sky-50 text-sky-800 border-sky-200",
          hover: "hover:border-sky-300 hover:shadow-sky-200/40",
        };
    }
  }, [tone]);

  return (
    <section id={id} className={`rounded-2xl border bg-white shadow-sm ${toneClasses.border}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className={`group flex w-full items-start justify-between gap-4 rounded-2xl px-4 py-4 text-start outline-none transition hover:-translate-y-[1px] hover:shadow-md ${toneClasses.hover} ${toneClasses.focus} focus-visible:ring-2 sm:px-5`}
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-extrabold tracking-tight text-slate-900">{title}</span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${toneClasses.badge}`}
            >
              {open ? "مفتوح" : "مغلق"}
            </span>
          </span>
          {subtitle ? (
            <span className="mt-1 block text-sm leading-relaxed text-slate-600">{subtitle}</span>
          ) : null}
        </span>
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition group-hover:bg-slate-50">
          <ChevronIcon open={open} icons={icons} />
        </span>
      </button>

      <div
        id={`${id}-panel`}
        className={`${open ? "block" : "hidden"} border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5`}
      >
        {children}
      </div>
    </section>
  );
}

export function SettingsBlocks({
  notificationInitial,
  globalIcons,
  employeeShareTemplate,
  customerOrderTemplate,
  telegramNewOrderTemplate,
  chatEnabledInitial,
  mandoubFeaturesInitial,
  preparerFeaturesInitial,
}: {
  notificationInitial: NotificationInitial;
  globalIcons: GlobalIconsConfig;
  employeeShareTemplate: string;
  customerOrderTemplate: string;
  telegramNewOrderTemplate: string;
  chatEnabledInitial: boolean;
  mandoubFeaturesInitial: RoleFeaturesConfig;
  preparerFeaturesInitial: RoleFeaturesConfig;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string>("ui-designer");
  const [chatEnabled, setChatEnabled] = useState(chatEnabledInitial);
  const [chatSaving, setChatSaving] = useState(false);

  const [mandoubFeatures, setMandoubFeatures] = useState(mandoubFeaturesInitial);
  const [preparerFeatures, setPreparerFeatures] = useState(preparerFeaturesInitial);
  const [roleFeaturesSaving, setRoleFeaturesSaving] = useState(false);

  const [howToShopUrl, setHowToShopUrl] = useState("");
  const [productCardBgUrl, setProductCardBgUrl] = useState("");
  const [productCardBgOpacity, setProductCardBgOpacity] = useState(40);
  const [storeOrdersExcelEnabled, setStoreOrdersExcelEnabled] = useState(true);
  const [aiEnabledStore, setAiEnabledStore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (openId === "store-settings") {
      fetch("/api/admin/settings/store")
        .then((res) => res.json())
        .then((data) => {
          setHowToShopUrl(data.how_to_shop_url || "");
          setProductCardBgUrl(data.product_card_bg_url || "");
          setStoreOrdersExcelEnabled(data.export_store_orders_excel_enabled !== false);
          setAiEnabledStore(data.ai_enabled === true);
          setProductCardBgOpacity(
            Number.isFinite(Number(data.product_card_bg_opacity))
              ? Math.min(100, Math.max(0, Math.round(Number(data.product_card_bg_opacity))))
              : 40
          );
        })
        .catch(err => console.error("Failed to load store settings:", err));
    }
  }, [openId]);

  return (
    <div className="space-y-4">
      <Block
        id="courier-buttons"
        title="أزرار الوصول السريع للمندوب ⚡"
        subtitle="تحكم في الأزرار التي تظهر للمندوب (لوكيشن، اتصال، واتساب...) لكل مندوب بشكل مستقل."
        open={openId === "courier-buttons"}
        onToggle={() => setOpenId((x) => (x === "courier-buttons" ? "" : "courier-buttons"))}
        tone="indigo"
        icons={globalIcons}
      >
        <CourierButtonsSettings />
      </Block>

      <Block
        id="role-features"
        title="مميزات الأدوار (المندوب والمجهز) 🛠️"
        subtitle="تحكم في ظهور أزرار الدردشة والذكاء الاصطناعي لكل دور بشكل مستقل."
        open={openId === "role-features"}
        onToggle={() => setOpenId((x) => (x === "role-features" ? "" : "role-features"))}
        tone="indigo"
        icons={globalIcons}
      >
        <div className="space-y-6">
          {/* المندوب */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              إعدادات المندوب
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={mandoubFeatures.chatEnabled}
                  onChange={async (e) => {
                    const newConfig = { ...mandoubFeatures, chatEnabled: e.target.checked };
                    setMandoubFeatures(newConfig);
                    setRoleFeaturesSaving(true);
                    try { await saveRoleFeaturesAction("mandoub", newConfig); } finally { setRoleFeaturesSaving(false); }
                  }}
                  disabled={roleFeaturesSaving}
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-slate-700">تفعيل الدردشة للمندوب</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={mandoubFeatures.aiEnabled}
                  onChange={async (e) => {
                    const newConfig = { ...mandoubFeatures, aiEnabled: e.target.checked };
                    setMandoubFeatures(newConfig);
                    setRoleFeaturesSaving(true);
                    try { await saveRoleFeaturesAction("mandoub", newConfig); } finally { setRoleFeaturesSaving(false); }
                  }}
                  disabled={roleFeaturesSaving}
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-slate-700">تفعيل الذكاء الاصطناعي للمندوب</span>
              </label>
            </div>
          </div>

          {/* المجهز */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              إعدادات المجهز
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={preparerFeatures.chatEnabled}
                  onChange={async (e) => {
                    const newConfig = { ...preparerFeatures, chatEnabled: e.target.checked };
                    setPreparerFeatures(newConfig);
                    setRoleFeaturesSaving(true);
                    try { await saveRoleFeaturesAction("preparer", newConfig); } finally { setRoleFeaturesSaving(false); }
                  }}
                  disabled={roleFeaturesSaving}
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-slate-700">تفعيل الدردشة للمجهز</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={preparerFeatures.aiEnabled}
                  onChange={async (e) => {
                    const newConfig = { ...preparerFeatures, aiEnabled: e.target.checked };
                    setPreparerFeatures(newConfig);
                    setRoleFeaturesSaving(true);
                    try { await saveRoleFeaturesAction("preparer", newConfig); } finally { setRoleFeaturesSaving(false); }
                  }}
                  disabled={roleFeaturesSaving}
                  className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-slate-700">تفعيل الذكاء الاصطناعي للمجهز</span>
              </label>
            </div>
          </div>

          {roleFeaturesSaving && <p className="text-[10px] font-bold text-indigo-600 animate-pulse">جاري الحفظ...</p>}
        </div>
      </Block>

      <Block
        id="chat-settings"
        title="نظام الدردشة 💬"
        subtitle="إيقاف أو تشغيل نظام الدردشة بين الإدارة والمندوبين والمجهزين."
        open={openId === "chat-settings"}
        onToggle={() => setOpenId((x) => (x === "chat-settings" ? "" : "chat-settings"))}
        tone="indigo"
        icons={globalIcons}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={chatEnabled}
                onChange={async (e) => {
                  const val = e.target.checked;
                  setChatEnabled(val);
                  setChatSaving(true);
                  try {
                    await saveChatSettingsAction(val);
                  } finally {
                    setChatSaving(false);
                  }
                }}
                disabled={chatSaving}
                className="mt-1 h-5 w-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="block text-sm font-black text-slate-800">تفعيل نظام الدردشة</span>
                <span className="mt-1 block text-xs font-bold text-slate-600">
                  عند إيقاف هذا الخيار، سيختفي زر الدردشة من جميع الواجهات (المندوب، المجهز، والمورد) ولن يتمكن أحد من إرسال رسائل.
                </span>
              </span>
            </label>
          </div>
          {chatSaving && <p className="text-[10px] font-bold text-indigo-600 animate-pulse">جاري الحفظ...</p>}
        </div>
      </Block>

      <Block
        id="icon-settings"
        title="تغيير الأيقونات والأنيميشن 🎭"
        subtitle="تحكم في شكل واجهة التحميل، أيقونات الاستلام والتسليم وغيرها."
        open={openId === "icon-settings"}
        onToggle={() => setOpenId((x) => (x === "icon-settings" ? "" : "icon-settings"))}
        tone="sky"
        icons={globalIcons}
      >
        <IconSettingsForm initial={globalIcons} />
      </Block>

      {/* قسم مصمم الواجهات الجديد */}
      <Block
        id="store-settings"
        title="إعدادات المتجر 🛒"
        subtitle="روابط تعليمية وتخصيصات واجهة الزبائن."
        open={openId === "store-settings"}
        onToggle={() => setOpenId((x) => (x === "store-settings" ? "" : "store-settings"))}
        tone="indigo"
        icons={globalIcons}
      >
        <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const formData = new FormData(e.currentTarget);

            try {
                const res = await fetch('/api/admin/settings/store', {
                    method: 'POST',
                    body: formData // إرسال FormData مباشرة لدعم الملفات
                });
                const data = await res.json();
                if (data.ok) {
                  setProductCardBgUrl(data.product_card_bg_url);
                  setStoreOrdersExcelEnabled(data.export_store_orders_excel_enabled !== false);
                  setProductCardBgOpacity(
                    Number.isFinite(Number(data.product_card_bg_opacity))
                      ? Math.min(100, Math.max(0, Math.round(Number(data.product_card_bg_opacity))))
                      : 40
                  );
                  alert("تم الحفظ بنجاح");
                }
            } finally {
                setLoading(false);
            }
        }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">رابط "طريقة التسوق" (فيديو يوتيوب)</label>
              <input
                name="how_to_shop_url"
                value={howToShopUrl}
                onChange={(e) => setHowToShopUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className="w-full px-4 py-2 rounded-xl border border-slate-300 outline-none focus:border-violet-500 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700">تغيير خلفية المنتج (رفع صورة)</label>
              <input
                type="file"
                name="product_card_bg_file"
                accept="image/*"
                className="w-full px-4 py-1.5 rounded-xl border border-slate-300 outline-none focus:border-violet-500 font-bold text-xs"
              />
              <input type="hidden" name="product_card_bg_url" value={productCardBgUrl} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-bold text-slate-700">شدة ظهور خلفية المنتج</label>
              <span className="text-xs font-black text-violet-700 bg-violet-50 px-2 py-1 rounded-lg border border-violet-100">
                {productCardBgOpacity}%
              </span>
            </div>
            <input
              type="range"
              name="product_card_bg_opacity"
              min={0}
              max={100}
              step={1}
              value={productCardBgOpacity}
              onChange={(e) => setProductCardBgOpacity(Number(e.target.value))}
              className="w-full accent-violet-600"
            />
            <p className="text-xs font-bold text-slate-500">
              0% تعني بدون خلفية، و100% تعني الخلفية قوية جدًا.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="export_store_orders_excel_enabled"
                  checked={storeOrdersExcelEnabled}
                  onChange={(e) => setStoreOrdersExcelEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-indigo-600"
                />
                <span>
                  <span className="block text-sm font-black text-slate-800">تفعيل تصدير طلبات المتجر إلى Excel</span>
                  <span className="mt-1 block text-xs font-bold text-slate-600">
                    عند الإيقاف، زر التصدير لن يظهر في صفحة سجل طلبات المتجر.
                  </span>
                </span>
              </label>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="ai_enabled"
                  checked={aiEnabledStore}
                  onChange={(e) => setAiEnabledStore(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-violet-600"
                />
                <span>
                  <span className="block text-sm font-black text-slate-800">تفعيل الذكاء الاصطناعي في المتجر</span>
                  <span className="mt-1 block text-xs font-bold text-slate-600">
                    إظهار مساعد الذكاء الاصطناعي للزبائن في واجهة المتجر.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {productCardBgUrl && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center gap-4">
              <div>
                <p className="text-xs font-bold text-slate-400 mb-2">الخلفية الحالية:</p>
                <div className="w-24 h-24 rounded-xl overflow-hidden border bg-white shadow-inner">
                  <img
                    src={productCardBgUrl}
                    className="w-full h-full object-cover transition-opacity duration-150"
                    style={{ opacity: productCardBgOpacity / 100 }}
                    alt="Preview"
                  />
                </div>
              </div>
              <div className="text-xs text-slate-500 font-bold">
                المعاينة هنا فورية حسب السلايدر. سيتم استبدال هذه الصورة عند رفع ملف جديد والحفظ.
              </div>
            </div>
          )}

          <button
            disabled={loading}
            className="px-6 py-2 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 disabled:opacity-50 w-full md:w-auto transition-all"
          >
            {loading ? "جاري الحفظ..." : "حفظ إعدادات الواجهة"}
          </button>
        </form>
      </Block>

      <Block
        id="ui-designer"
        title="مصمم الواجهات الذكي 🎨"
        subtitle="تحكم كامل في الألوان، الصور، وترتيب البلوكات في الموقع."
        open={openId === "ui-designer"}
        onToggle={() => setOpenId((x) => (x === "ui-designer" ? "" : "ui-designer"))}
        tone="indigo"
        icons={globalIcons}
      >
        <Link
          href="/admin/settings/ui-designer"
          className="group relative flex items-start justify-between gap-4 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm outline-none transition hover:-translate-y-[1px] hover:border-indigo-300 hover:bg-gradient-to-b hover:from-indigo-50/70 hover:to-white hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-300/60 sm:p-5"
        >
          <div className="min-w-0">
            <p className="font-extrabold text-slate-900 text-lg">فتح المصمم 🖌️</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              قم بتغيير ترتيب العناصر في صفحة الطلب، تعديل ألوان المحفظة، ووضع خلفيات صور مخصصة لكل حالة.
            </p>
            <p className="mt-2 text-xs font-black text-indigo-700 transition group-hover:text-indigo-800">
              دخول إلى واجهة التعديل الآن ←
            </p>
          </div>
          <span
            className="mt-1 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-200 bg-white text-indigo-700 shadow-sm transition group-hover:border-indigo-300 group-hover:bg-indigo-50"
            aria-hidden
          >
            <DynamicIcon
                iconKey="ui_arrow_right"
                config={globalIcons}
                className="h-6 w-6 transition group-hover:-translate-x-0.5 rotate-180"
                fallback={
                    <svg
                      className="h-6 w-6 transition group-hover:-translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                }
            />
          </span>
        </Link>
      </Block>

      <Block
        id="pricing-config"
        title="إعدادات التسعير والأنواع (لحم/سمك) 💰"
        subtitle="تعديل الكلمات المفتاحية للحوم والأسماك، وضبط أسعار القصاب التلقائية."
        open={openId === "pricing-config"}
        onToggle={() => setOpenId((x) => (x === "pricing-config" ? "" : "pricing-config"))}
        tone="amber"
        icons={globalIcons}
      >
        <PricingSettingsForm />
      </Block>

      <Block
        id="whatsapp"
        title="إعدادات واتساب"
        subtitle="أزرار واتساب للمندوب والنماذج حسب حالة الطلب."
        open={openId === "whatsapp"}
        onToggle={() => setOpenId((x) => (x === "whatsapp" ? "" : "whatsapp"))}
        tone="emerald"
        icons={globalIcons}
      >
        <div className="space-y-4">
          <WhatsappTemplateSettingsForm
            initialEmployeeTemplate={employeeShareTemplate}
            initialCustomerTemplate={customerOrderTemplate}
            initialTelegramTemplate={telegramNewOrderTemplate}
          />
          <Link
            href="/admin/wa-buttons"
            className="group relative flex items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm outline-none transition hover:-translate-y-[1px] hover:border-emerald-300 hover:bg-gradient-to-b hover:from-emerald-50/70 hover:to-white hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-300/60 sm:p-5"
          >
            <div className="min-w-0">
              <p className="font-extrabold text-slate-900">أزرار واتساب</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                تعريف أزرار المندوب ثم نصوص الرسائل (من «النماذج») حسب حالة الطلب ولوكيشن الزبون.
              </p>
              <p className="mt-2 text-xs font-bold text-emerald-700 transition group-hover:text-emerald-800">
                فتح الصفحة
              </p>
            </div>
            <span
              className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-700 shadow-sm transition group-hover:border-emerald-300 group-hover:bg-emerald-50"
              aria-hidden
            >
              <DynamicIcon
                  iconKey="ui_arrow_right"
                  config={globalIcons}
                  className="h-5 w-5 transition group-hover:-translate-x-0.5 rotate-180"
                  fallback={
                      <svg
                        className="h-5 w-5 transition group-hover:-translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.2}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                  }
              />
            </span>
          </Link>
        </div>
      </Block>

      <Block
        id="notifications"
        title="إعدادات الإشعارات"
        subtitle="تشغيل/إيقاف، النصوص، نغمة الصوت، والظهور في شريط الإشعارات."
        open={openId === "notifications"}
        onToggle={() => setOpenId((x) => (x === "notifications" ? "" : "notifications"))}
        tone="sky"
        icons={globalIcons}
      >
        <p className="text-sm text-slate-600">
          لإشعارات الدفع الحقيقية حتى عند إغلاق المتصفح أو التطبيق، يجب ضبط متغيرات مفاتيح VAPID على الخادم (انظر{" "}
          <code className="mx-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.example</code>). بعدها يضغط
          المستخدم «تفعيل إشعارات المتصفح» من لوحة الإدارة أو المندوب ليُسجَّل الجهاز.
        </p>
        <div className="mt-4">
          <NotificationSettingsForm initial={notificationInitial} />
        </div>
      </Block>

      <Block
        id="test-push"
        title="اختبار الإشعارات"
        subtitle="إرسال إشعار تجريبي للأجهزة المسجّلة (Web Push)."
        open={openId === "test-push"}
        onToggle={() => setOpenId((x) => (x === "test-push" ? "" : "test-push"))}
        tone="amber"
        icons={globalIcons}
      >
        <p className="text-sm text-slate-600">
          تنبيهات «طلب جديد» أثناء فتح لوحة الإدارة قد تأتي أيضاً من تحديث الصفحة كل بضع ثوانٍ — أما عند إغلاق التبويب
          فيعتمد التنبيه على Web Push فقط. على iPhone يجب إضافة الموقع للشاشة الرئيسية (PWA) لتعمل الإشعارات في الخلفية.
        </p>
        <div className="mt-4">
          <TestPushNotificationsForm />
        </div>
      </Block>

      <Block
        id="purge-demo"
        title="المسح والحذف النهائي"
        subtitle="تصفير تجريبي شامل (خطير وغير قابل للتراجع)."
        open={openId === "purge-demo"}
        onToggle={() => setOpenId((x) => (x === "purge-demo" ? "" : "purge-demo"))}
        tone="rose"
        icons={globalIcons}
      >
        <div className="space-y-6">
          <CleanupBase64Form />
          <hr className="border-rose-100" />
          <PurgeDemoDataForm />
        </div>
      </Block>
    </div>
  );
}
