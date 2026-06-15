/**
 * مدير إرسال إشعارات OneSignal من السيرفر باستخدام fetch المباشر.
 */

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "5c2acf6f-f2c0-40f2-830d-138f8a9e8c0a";
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

export async function sendOneSignalNotification(options: {
  title: string;
  body: string;
  url: string;
  externalIds: string[];
  sound?: string;
  data?: any;
}): Promise<boolean> {
  if (!ONESIGNAL_REST_API_KEY) {
    console.warn("[OneSignal] ONESIGNAL_REST_API_KEY is not configured in environment variables.");
    return false;
  }

  const isAdmin = options.externalIds.includes("admin_global");

  const notification: any = {
    app_id: ONESIGNAL_APP_ID,
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
    android_sound: options.sound,
    ios_sound: options.sound ? `${options.sound}.wav` : undefined,
    android_visibility: 1,
    priority: 10,
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
    console.log("[OneSignal] Sending notification to OneSignal API...");
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${ONESIGNAL_REST_API_KEY.trim()}`,
      },
      body: JSON.stringify(notification),
    });

    const data = await response.ok ? await response.json() : await response.text();
    if (response.ok) {
      console.log("[OneSignal] Notification successfully sent:", data);
      return true;
    } else {
      console.error("[OneSignal] API responded with error:", response.status, data);
      return false;
    }
  } catch (e) {
    console.error("[OneSignal] Fetch exception occurred:", e);
    return false;
  }
}
