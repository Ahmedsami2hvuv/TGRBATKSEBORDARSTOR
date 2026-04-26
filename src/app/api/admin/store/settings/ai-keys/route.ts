import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const { provider, apiKey, action, id } = await req.json();

        if (action === "delete") {
            await prisma.aIConfig.delete({ where: { id } });
            return NextResponse.json({ ok: true });
        }

        // إضافة مفتاح جديد (يمكن تكرار نفس الـ provider)
        await prisma.aIConfig.create({
            data: {
                provider: provider || "removebg",
                apiKey,
                isActive: true,
                label: "مفتاح إزالة خلفية"
            }
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
