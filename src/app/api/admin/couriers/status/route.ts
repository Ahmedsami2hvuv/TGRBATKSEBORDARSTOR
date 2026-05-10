import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const couriers = await prisma.courier.findMany({
      where: {
        blocked: false,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        lastCourierLat: true,
        lastCourierLng: true,
        lastCourierLocationAt: true,
      },
    });

    const now = new Date();
    const formattedCouriers = couriers.map((c) => {
      // تحديد الحالة بناءً على آخر تحديث للموقع (مثلاً خلال آخر 10 دقائق يعتبر متصل)
      let status = "غير متصل";
      if (c.lastCourierLocationAt) {
        const diff = (now.getTime() - new Date(c.lastCourierLocationAt).getTime()) / 1000 / 60;
        if (diff < 10) {
            status = "متصل";
        } else if (diff < 60) {
            status = "مشغول";
        }
      }

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        lat: c.lastCourierLat || 0,
        lng: c.lastCourierLng || 0,
        status: status,
      };
    });

    return NextResponse.json(formattedCouriers);
  } catch (error) {
    console.error("Couriers Status Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
