import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "5c2acf6f-f2c0-40f2-830d-138f8a9e8c0a";
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: "ONESIGNAL_REST_API_KEY is not configured in Vercel environment variables.",
      appId,
    });
  }

  const mode = request.nextUrl.searchParams.get("mode") || "tag";

  const notification: any = {
    app_id: appId,
    contents: {
      ar: "هذا الإشعار لتجربة سرعة وصول OneSignal للتطبيق",
      en: "هذا الإشعار لتجربة سرعة وصول OneSignal للتطبيق",
    },
    headings: {
      ar: "🔔 فحص تجريبي فوري",
      en: "🔔 فحص تجريبي فوري",
    },
    target_channel: "push",
    url: "https://aboakbr.com/abo1stor3hlaa2kbr8-47/orders/pending",
  };

  if (mode === "tag") {
    notification.filters = [
      { field: "tag", key: "role", relation: "=", value: "admin" }
    ];
  } else {
    notification.include_aliases = {
      external_id: ["admin_global"],
    };
  }

  // 1. التحقق من وجود المستخدم admin_global في خوادم وان سيجنال
  let userDetails: any = null;
  try {
    const userResponse = await fetch(
      `https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/admin_global`,
      {
        headers: {
          "Authorization": `Key ${apiKey.trim()}`,
        },
      }
    );
    if (userResponse.ok) {
      userDetails = await userResponse.json();
    } else {
      const errText = await userResponse.text();
      userDetails = { error: `User request returned status ${userResponse.status}`, raw: errText };
    }
  } catch (err: any) {
    userDetails = { error: err.message || err };
  }

  // 1.2 جلب إعدادات الإشعارات الحالية من قاعدة البيانات
  let notificationSettings = null;
  try {
    const { getOrCreateNotificationSettings } = await import("@/lib/notification-settings");
    notificationSettings = await getOrCreateNotificationSettings();
  } catch (err: any) {
    notificationSettings = { error: err.message || err };
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${apiKey.trim()}`,
      },
      body: JSON.stringify(notification),
    });

    const data = await response.json();
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      oneSignalResponse: data,
      adminGlobalUser: userDetails,
      notificationSettings,
      appId,
      apiKeyLength: apiKey.length,
      apiKeySnippet: apiKey.length > 8 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "too_short",
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || err,
      adminGlobalUser: userDetails,
      notificationSettings,
      appId,
    });
  }
}
