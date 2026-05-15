import { ad } from "@/lib/admin-ui";
import { prisma } from "@/lib/prisma";
import { getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { normalizeNotificationSoundPreset } from "@/lib/notification-sound-presets";
import { SettingsBlocks } from "./settings-blocks";
import { getGlobalIcons } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getEmployeeWhatsappShareTemplate, getCustomerOrderWhatsappTemplate } from "@/lib/whatsapp-template-settings";
import { getTelegramNewOrderTemplate } from "@/lib/telegram-notify";
import { isChatEnabledGlobally } from "@/lib/portal-chat-settings";
import { getRoleFeatures } from "@/lib/role-features-settings";

export const metadata = {
  title: "الإعدادات — KSEBORDARSTOR",
};

export default async function SettingsPage() {
  // استخدام try-catch لمنع انهيار الصفحة بالكامل في حال وجود خطأ في أحد الوعود
  let data;
  try {
    data = await Promise.all([
      getOrCreateNotificationSettings().catch(e => { console.error("Settings Error:", e); return null; }),
      getGlobalIcons().catch(e => { console.error("Icons Error:", e); return {}; }),
      getEmployeeWhatsappShareTemplate().catch(() => ""),
      getCustomerOrderWhatsappTemplate().catch(() => ""),
      getTelegramNewOrderTemplate().catch(() => ""),
      isChatEnabledGlobally().catch(() => true),
      getRoleFeatures("mandoub").catch(() => ({ chatEnabled: true, aiEnabled: false })),
      getRoleFeatures("preparer").catch(() => ({ chatEnabled: true, aiEnabled: false })),
      prisma.telegramAdmin.findMany({ orderBy: { createdAt: "desc" } }).catch(() => []),
      prisma.telegramBot.findMany({ orderBy: { createdAt: "desc" } }).catch(() => []),
    ]);
  } catch (e) {
    console.error("Critical Settings Page Error:", e);
    return <div className="p-8 text-red-600 font-bold">حدث خطأ أثناء تحميل الإعدادات. يرجى التأكد من اتصال قاعدة البيانات.</div>;
  }

  const [
    notificationSettings,
    icons,
    employeeShareTemplate,
    customerOrderTemplate,
    telegramNewOrderTemplate,
    chatEnabled,
    mandoubFeatures,
    preparerFeatures,
    telegramAdmins,
    telegramBots
  ] = data;

  // تأمين كائن الإشعارات في حال كان null
  const ns = notificationSettings || {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className={ad.h1}>الإعدادات</h1>
        <p className={ad.lead}>
          اختر الإعداد الذي تريد تعديله. سيتم تطبيق التعديلات على واجهة المندوب
          مباشرة بعد الحفظ.
        </p>
      </div>

      <SettingsBlocks
        globalIcons={icons as any}
        employeeShareTemplate={employeeShareTemplate as string}
        customerOrderTemplate={customerOrderTemplate as string}
        telegramNewOrderTemplate={telegramNewOrderTemplate as string}
        chatEnabledInitial={!!chatEnabled}
        mandoubFeaturesInitial={mandoubFeatures as any}
        preparerFeaturesInitial={preparerFeatures as any}
        telegramAdminsInitial={telegramAdmins as any}
        telegramBotsInitial={telegramBots as any}
        notificationInitial={{
          adminEnabled: ns.adminEnabled ?? true,
          adminTitleSingle: ns.adminTitleSingle ?? "طلب جديد #{orderNumber}",
          adminTemplateSingle: ns.adminTemplateSingle ?? "طلب جديد بانتظار الموافقة (#{orderNumber})",
          adminTemplateMultiple: ns.adminTemplateMultiple ?? "وصلت {count} طلبات جديدة بانتظار الموافقة",
          adminSoundEnabled: ns.adminSoundEnabled ?? true,
          adminSoundPreset: normalizeNotificationSoundPreset(
            ns.adminSoundPreset ?? "beep",
          ),
          mandoubEnabled: ns.mandoubEnabled ?? true,
          mandoubTitleSingle: ns.mandoubTitleSingle ?? "طلب جديد #{orderNumber}",
          mandoubTemplateSingle: ns.mandoubTemplateSingle ?? "تم إسناد طلب جديد إليك (#{orderNumber})",
          mandoubTemplateMultiple: ns.mandoubTemplateMultiple ?? "تم إسناد {count} طلبات جديدة إليك",
          mandoubSoundEnabled: ns.mandoubSoundEnabled ?? true,
          mandoubSoundPreset: normalizeNotificationSoundPreset(
            ns.mandoubSoundPreset ?? "beep",
          ),
          preparerEnabled: ns.preparerEnabled ?? true,
          preparerTitleSingle: ns.preparerTitleSingle ?? "تجهيز طلب #{orderNumber}",
          preparerTemplateSingle: ns.preparerTemplateSingle ?? "لديك طلب تجهيز جديد (#{orderNumber})",
          preparerTemplateMultiple: ns.preparerTemplateMultiple ?? "لديك {count} طلبات تجهيز جديدة",
          preparerTemplateWebsite: ns.preparerTemplateWebsite ?? "لديك طلب جديد مسند من الموقع (#{orderNumber})",
          preparerSoundEnabled: ns.preparerSoundEnabled ?? true,
          preparerSoundPreset: normalizeNotificationSoundPreset(
            ns.preparerSoundPreset ?? "phone",
          ),
          telegramAdminIds: ns.telegramAdminIds ?? "",
        }}
      />
    </div>
  );
}

