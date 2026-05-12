import { ad } from "@/lib/admin-ui";
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
  const [notificationSettings, icons, employeeShareTemplate, customerOrderTemplate, telegramNewOrderTemplate, chatEnabled, mandoubFeatures, preparerFeatures] = await Promise.all([
    getOrCreateNotificationSettings(),
    getGlobalIcons(),
    getEmployeeWhatsappShareTemplate(),
    getCustomerOrderWhatsappTemplate(),
    getTelegramNewOrderTemplate(),
    isChatEnabledGlobally(),
    getRoleFeatures("mandoub"),
    getRoleFeatures("preparer"),
  ]);

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
        globalIcons={icons}
        employeeShareTemplate={employeeShareTemplate}
        customerOrderTemplate={customerOrderTemplate}
        telegramNewOrderTemplate={telegramNewOrderTemplate}
        chatEnabledInitial={chatEnabled}
        mandoubFeaturesInitial={mandoubFeatures}
        preparerFeaturesInitial={preparerFeatures}
        notificationInitial={{
          adminEnabled: notificationSettings.adminEnabled ?? true,
          adminTitleSingle: notificationSettings.adminTitleSingle ?? "طلب جديد #{orderNumber}",
          adminTemplateSingle: notificationSettings.adminTemplateSingle ?? "طلب جديد بانتظار الموافقة (#{orderNumber})",
          adminTemplateMultiple: notificationSettings.adminTemplateMultiple ?? "وصلت {count} طلبات جديدة بانتظار الموافقة",
          adminSoundEnabled: notificationSettings.adminSoundEnabled ?? true,
          adminSoundPreset: normalizeNotificationSoundPreset(
            notificationSettings.adminSoundPreset ?? "beep",
          ),
          mandoubEnabled: notificationSettings.mandoubEnabled ?? true,
          mandoubTitleSingle: notificationSettings.mandoubTitleSingle ?? "طلب جديد #{orderNumber}",
          mandoubTemplateSingle: notificationSettings.mandoubTemplateSingle ?? "تم إسناد طلب جديد إليك (#{orderNumber})",
          mandoubTemplateMultiple: notificationSettings.mandoubTemplateMultiple ?? "تم إسناد {count} طلبات جديدة إليك",
          mandoubSoundEnabled: notificationSettings.mandoubSoundEnabled ?? true,
          mandoubSoundPreset: normalizeNotificationSoundPreset(
            notificationSettings.mandoubSoundPreset ?? "beep",
          ),
          preparerEnabled: notificationSettings.preparerEnabled ?? true,
          preparerTitleSingle: notificationSettings.preparerTitleSingle ?? "تجهيز طلب #{orderNumber}",
          preparerTemplateSingle: notificationSettings.preparerTemplateSingle ?? "لديك طلب تجهيز جديد (#{orderNumber})",
          preparerTemplateMultiple: notificationSettings.preparerTemplateMultiple ?? "لديك {count} طلبات تجهيز جديدة",
          preparerTemplateWebsite: notificationSettings.preparerTemplateWebsite ?? "لديك طلب جديد مسند من الموقع (#{orderNumber})",
          preparerSoundEnabled: notificationSettings.preparerSoundEnabled ?? true,
          preparerSoundPreset: normalizeNotificationSoundPreset(
            notificationSettings.preparerSoundPreset ?? "phone",
          ),
        }}
      />
    </div>
  );
}

