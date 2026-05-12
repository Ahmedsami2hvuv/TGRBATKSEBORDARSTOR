import * as OneSignal from "onesignal-node";

/**
 * مدير إرسال إشعارات OneSignal من السيرفر.
 */

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "aa21547a-4853-4ced-8823-6fd8c778b7b1";
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
  data?: any;
}) {
  const osClient = getClient();
  if (!osClient) return false;

  const notification = {
    contents: {
      ar: options.body,
      en: options.body,
    },
    headings: {
      ar: options.title,
      en: options.title,
    },
    include_aliases: {
      external_id: options.externalIds,
    },
    target_channel: "push",
    url: options.url,
    data: options.data,
    // لجعل الإشعار يبقى على الشاشة في الأندرويد حتى يتم التفاعل معه
    android_visibility: 1,
    priority: 10,
  };

  try {
    const response = await osClient.createNotification(notification as any);
    console.log("OneSignal Notification Sent:", response.body);
    return true;
  } catch (e) {
    console.error("OneSignal Notification Error:", e);
    return false;
  }
}
