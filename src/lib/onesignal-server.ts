/**
 * مدير إرسال إشعارات OneSignal من السيرفر باستخدام fetch المباشر.
 */

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "5c2acf6f-f2c0-40f2-830d-138f8a9e8c0a";
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

const ONESIGNAL_MANDOB_APP_ID = process.env.ONESIGNAL_MANDOB_APP_ID || "628d3268-9fda-405d-8d07-12d026810b84";
const ONESIGNAL_MANDOB_REST_API_KEY = process.env.ONESIGNAL_MANDOB_REST_API_KEY;

export async function sendOneSignalNotification(options: {
  title: string;
  body: string;
  url: string;
  externalIds: string[];
  sound?: string;
  data?: any;
}): Promise<boolean> {
  const isAdmin = options.externalIds.includes("admin_global");
  
  const targetAppId = isAdmin ? ONESIGNAL_APP_ID : ONESIGNAL_MANDOB_APP_ID;
  const targetApiKey = isAdmin ? ONESIGNAL_REST_API_KEY : ONESIGNAL_MANDOB_REST_API_KEY;

  if (!targetApiKey) {
    console.warn(`[OneSignal] REST API Key is not configured for ${isAdmin ? 'Admin' : 'Mandob'}.`);
    return false;
  }

  const notification: any = {
    app_id: targetAppId,
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
    console.log(`[OneSignal] Sending notification to OneSignal API (${isAdmin ? 'Admin' : 'Mandob'})...`);
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${targetApiKey.trim()}`,
      },
      body: JSON.stringify(notification),
    });

    const data = await response.ok ? await response.json() : await response.text();
    if (response.ok) {
      console.log(`[OneSignal] Notification successfully sent to ${isAdmin ? 'Admin' : 'Mandob'}:`, data);
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
