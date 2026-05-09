import { ad } from "@/lib/admin-ui";
import { getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { normalizeNotificationSoundPreset } from "@/lib/notification-sound-presets";
import { SettingsBlocks } from "./settings-blocks";
import { getGlobalIcons } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";
import { getEmployeeWhatsappShareTemplate } from "@/lib/whatsapp-template-settings";
import { isChatEnabledGlobally } from "@/lib/portal-chat-settings";
import { getRoleFeatures } from "@/lib/role-features-settings";

export const metadata = {
  title: "الإعدادات — KSEBORDARSTOR",
};

export default async function SettingsPage() {
  const [notificationSettings, icons, employeeShareTemplate, chatEnabled, mandoubFeatures, preparerFeatures] = await Promise.all([
    getOrCreateNotificationSettings(),
    getGlobalIcons(),
    getEmployeeWhatsappShareTemplate(),
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
        chatEnabledInitial={chatEnabled}
        mandoubFeaturesInitial={mandoubFeatures}
        preparerFeaturesInitial={preparerFeatures}
        notificationInitial={{
          adminEnabled: notificationSettings.adminEnabled,
          adminTemplateSingle: notificationSettings.adminTemplateSingle,
          adminTemplateMultiple: notificationSettings.adminTemplateMultiple,
          adminSoundEnabled: notificationSettings.adminSoundEnabled,
          adminSoundPreset: normalizeNotificationSoundPreset(
            notificationSettings.adminSoundPreset ?? "beep",
          ),
          mandoubEnabled: notificationSettings.mandoubEnabled,
          mandoubTemplateSingle: notificationSettings.mandoubTemplateSingle,
          mandoubTemplateMultiple: notificationSettings.mandoubTemplateMultiple,
          mandoubSoundEnabled: notificationSettings.mandoubSoundEnabled,
          mandoubSoundPreset: normalizeNotificationSoundPreset(
            notificationSettings.mandoubSoundPreset ?? "beep",
          ),
          preparerEnabled: notificationSettings.preparerEnabled,
          preparerTemplateSingle: notificationSettings.preparerTemplateSingle,
          preparerTemplateMultiple: notificationSettings.preparerTemplateMultiple,
          preparerSoundEnabled: notificationSettings.preparerSoundEnabled,
          preparerSoundPreset: normalizeNotificationSoundPreset(
            notificationSettings.preparerSoundPreset ?? "phone",
          ),
        }}
      />
    </div>
  );
}

