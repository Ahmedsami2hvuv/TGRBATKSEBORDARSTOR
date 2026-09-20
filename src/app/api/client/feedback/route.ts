import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      shopId,
      shopName,
      employeeName,
      employeePhone,
      designRating,
      designReason,
      buttonsRating,
      buttonsReason,
      fieldsRating,
      fieldsReason,
      easeRating,
      easeReason,
      generalFeedback,
    } = body;

    const feedback = await prisma.clientFeedback.create({
      data: {
        shopId: shopId || null,
        shopName: shopName || "",
        employeeName: employeeName || "",
        employeePhone: employeePhone || "",
        designRating: Number(designRating) || 5,
        designReason: designReason ? String(designReason).trim() : null,
        buttonsRating: Number(buttonsRating) || 5,
        buttonsReason: buttonsReason ? String(buttonsReason).trim() : null,
        fieldsRating: Number(fieldsRating) || 5,
        fieldsReason: fieldsReason ? String(fieldsReason).trim() : null,
        easeRating: Number(easeRating) || 5,
        easeReason: easeReason ? String(easeReason).trim() : null,
        generalFeedback: generalFeedback ? String(generalFeedback).trim() : null,
      },
    });

    return NextResponse.json({ ok: true, feedback });
  } catch (err: any) {
    console.error("Error creating client feedback:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "فشل إرسال التقييم" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const feedbacks = await prisma.clientFeedback.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        shop: {
          select: { id: true, name: true, phone: true, photoUrl: true },
        },
      },
      take: 100,
    });

    return NextResponse.json({ ok: true, feedbacks });
  } catch (err: any) {
    console.error("Error fetching client feedbacks:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "فشل جلب التقييمات" },
      { status: 500 }
    );
  }
}
