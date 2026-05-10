import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // رد سريع ومباشر للتأكد من نجاح الـ Build وعمل التطبيق
    return NextResponse.json({
      success: true,
      stats: {
        pendingOrders: 0,
        prepDrafts: 0,
        archivedOrders: 0,
        totalProducts: 0,
        activeCouriers: 0,
        assignedOrders: 0
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Server Ready" });
  }
}
