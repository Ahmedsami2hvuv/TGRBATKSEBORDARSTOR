import { NextRequest, NextResponse } from "next/server";
import { processShopStoreOrder } from "@/lib/shop-store-order";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await processShopStoreOrder(body);

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      orderNumber: result.orderNumber,
      totalPrice: result.totalPrice,
      whatsappUrl: result.whatsappUrl,
    });
  } catch (error: any) {
    console.error("[ShopStoreOrderAPI] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "حدث خطأ أثناء إتمام الطلب" },
      { status: 500 }
    );
  }
}
