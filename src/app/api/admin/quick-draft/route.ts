import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.split(" ")[1];
    
    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 401 });
    }

    const body = await request.json();
    const { text, preparerId } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: "النص مفقود أو غير صالح" }, { status: 400 });
    }

    if (!preparerId) {
      return NextResponse.json({ error: "يجب اختيار مجهز" }, { status: 400 });
    }

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const titleLine = lines.length > 0 ? lines[0].substring(0, 50) : "تجهيز تسوق جديد";

    const draft = await prisma.companyPreparerShoppingDraft.create({
      data: {
        rawListText: text,
        preparerId: preparerId,
        titleLine: titleLine,
        status: "draft"
      }
    });

    return NextResponse.json({ success: true, draftId: draft.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
