import { NextRequest, NextResponse } from "next/server";
import { enhanceDoorImageWithAI } from "@/lib/ai-image-enhancer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64 } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "الصورة غير موجودة أو غير صالحة" }, { status: 400 });
    }

    const result = await enhanceDoorImageWithAI(imageBase64);

    return NextResponse.json({
      success: true,
      enhanced: result.enhanced,
      base64Image: result.base64Image,
      reason: result.reason,
      keyUsedLabel: result.keyUsedLabel,
    });
  } catch (error: any) {
    console.error("Enhance door route error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء فحص وتحسين الصورة" }, { status: 500 });
  }
}
