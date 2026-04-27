import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // حذف الملفات الشخصية أولاً ثم الزبائن
    await prisma.customerProfile.deleteMany({});
    await prisma.customer.deleteMany({});

    return NextResponse.json({ success: true, message: "تم مسح كافة الزبائن بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
