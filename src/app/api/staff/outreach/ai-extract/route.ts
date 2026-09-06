import { NextResponse } from "next/server";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { prisma } from "@/lib/prisma";
import { getAllActiveGeminiKeys, markGeminiKeySuccess, markGeminiKeyError } from "@/lib/gemini-pool";
import { extractPhonesPure } from "@/app/staff/portal/outreach/constants";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { staffEmployeeId, token, sig, imageBase64 } = body;

    if (!staffEmployeeId || !token || !sig || !imageBase64) {
      return NextResponse.json({ error: "بيانات ناقصة أو غير مكتملة." }, { status: 400 });
    }

    // التحقق من صحة توقيع الموظف
    const v = verifyStaffEmployeePortalQuery(staffEmployeeId, token, sig);
    if (!v.ok) {
      return NextResponse.json({ error: "جلسة الموظف غير صالحة أو منتهية." }, { status: 401 });
    }

    const emp = await prisma.staffEmployee.findUnique({
      where: { id: staffEmployeeId },
      select: { id: true, active: true },
    });
    if (!emp || !emp.active) {
      return NextResponse.json({ error: "حساب الموظف غير نشط." }, { status: 403 });
    }

    // جلب مفاتيح Gemini النشطة
    const keys = await getAllActiveGeminiKeys();
    if (keys.length === 0) {
      return NextResponse.json({
        error: "لا يوجد مفتاح ذكاء اصطناعي متاح حالياً. يرجى التأكد من إضافة مفاتيح في الإعدادات.",
      }, { status: 500 });
    }

    let cleanBase64 = imageBase64;
    let mimeType = "image/jpeg";

    if (imageBase64.startsWith("data:")) {
      const parts = imageBase64.split(";base64,");
      if (parts.length === 2) {
        mimeType = parts[0].replace("data:", "").split(";")[0] || "image/jpeg";
        cleanBase64 = parts[1];
      }
    }

    const prompt = `استخرج بدقة فائقة كل أرقام الهواتف (العراقية والدولية مثل 07... أو 964... أو +964...) وكل أسماء المستخدمين واليوزرات (مثل @username أو المعرفات) وروابط الواتساب (wa.me) الظاهرة في هذه الصورة أو لقطة الشاشة.
أرجع فقط قائمة بالأرقام واليوزرات المستخرجة، كل رقم أو يوزر في سطر مستقل، بدون أي كلمات أو شروحات إضافية.`;

    let extractedText = "";
    let lastError = "";

    const candidateModels = [
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-2.5-flash",
      "gemini-flash-latest"
    ];

    for (const k of keys) {
      for (const model of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${k.key}`;
          const geminiReqBody = {
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
          };

          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiReqBody),
          });

          if (res.ok) {
            const data = await res.json();
            const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResult && typeof textResult === "string" && textResult.trim()) {
              extractedText = textResult;
              await markGeminiKeySuccess(k.id);
              break;
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            lastError = errData?.error?.message || `HTTP ${res.status}`;
            await markGeminiKeyError(k.id, res.status === 429);
          }
        } catch (e: any) {
          lastError = e?.message || "فشل الاتصال بـ Gemini API";
        }
      }
      if (extractedText) break;
    }

    if (!extractedText) {
      return NextResponse.json({
        error: lastError || "لم يتمكن الذكاء الاصطناعي من قراءة الصورة أو استخراج الأرقام منها.",
      }, { status: 500 });
    }

    const phones = extractPhonesPure(extractedText);
    if (phones.length === 0) {
      return NextResponse.json({
        error: "تم فحص الصورة بنجاح ولكن لم يتم العثور على أرقام هواتف واضحة فيها.",
      }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      rawText: phones.map((p) => p.phone).join("\n"),
      count: phones.length,
      phones,
    });
  } catch (error: any) {
    console.error("AI Extract Route Error:", error);
    return NextResponse.json({ error: error?.message || "خطأ فني في معالجة الصورة." }, { status: 500 });
  }
}
