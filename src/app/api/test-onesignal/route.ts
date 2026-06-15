import { NextResponse } from "next/server";
import { sendOneSignalNotification } from "@/lib/onesignal-server";

export async function GET() {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "aa21547a-4853-4ced-8823-6fd8c778b7b1";
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: "ONESIGNAL_REST_API_KEY is not configured in Vercel environment variables.",
      appId,
    });
  }

  try {
    const result = await sendOneSignalNotification({
      title: "🔔 فحص تجريبي فوري",
      body: "هذا الإشعار لتجربة سرعة وصول OneSignal للتطبيق",
      url: "https://aboakbar.vercel.app/abo1stor3hlaa2kbr8-47/orders/pending",
      externalIds: ["admin_global"],
      sound: "default",
    });

    return NextResponse.json({
      success: result,
      message: result ? "تم إرسال طلب الإشعار لـ OneSignal بنجاح." : "فشل إرسال الإشعار لـ OneSignal.",
      appId,
      hasApiKey: !!apiKey,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || err,
      appId,
    });
  }
}
