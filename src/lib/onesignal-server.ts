import * as OneSignal from "onesignal-node";

/**
 * مدير إرسال إشعارات OneSignal من السيرفر.
 */

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "5c2acf6f-f2c0-40f2-830d-138f8a9e8c0a";
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

let client: OneSignal.Client | null = null;

function getClient() {
  if (client) return client;
  if (!ONESIGNAL_REST_API_KEY) {
    console.warn("OneSignal: ONESIGNAL_REST_API_KEY is not configured.");
    return null;
  }
  client = new OneSignal.Client(ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY);
  return client;
}

export async function sendOneSignalNotification(options: {
  title: string;
  body: string;
  url: string;
  externalIds: string[];
  sound?: string;
  data?: any;
}) {
  const osClient = getClient();
  if (!osClient) return false;

  const isAdmin = options.externalIds.includes("admin_global");

  const notification: any = {
    contents: {
      ar: options.body,
      en: options.body,
    },
    headings: {
      ar: options.title,
      en: options.title,
    },
    target_channel: "push",
    url: options.url,
    data: options.data,
    // إرسال اسم النغمة المختارة
    android_sound: options.sound,
    ios_sound: options.sound ? `${options.sound}.wav` : undefined,
    android_visibility: 1,
    priority: 10,
    android_channel_id: "push-notifications", // تحديد قناة افتراضية
    huawei_priority: 10,
    web_push_priority: "high",
    android_accent_color: "4f46e5",
    small_icon: "ic_stat_onesignal_default",
  };

  if (isAdmin) {
    notification.filters = [
      { field: "tag", key: "role", relation: "=", value: "admin" }
    ];
  } else {
    notification.include_aliases = {
      external_id: options.externalIds,
    };
    notification.include_external_user_ids = options.externalIds;
  }

  try {
    const response = await osClient.createNotification(notification as any);
    console.log("OneSignal Notification Sent:", response.body);
    return true;
  } catch (e) {
    console.error("OneSignal Notification Error:", e);
    return false;
  }
}
