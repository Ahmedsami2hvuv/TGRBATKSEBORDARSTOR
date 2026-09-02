import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phoneRaw = searchParams.get("phone")?.trim() ?? "";
  const shopId = searchParams.get("shopId")?.trim() ?? "";
  const phone = normalizeIraqMobileLocal11(phoneRaw) || phoneRaw;

  if (!phone) {
    return NextResponse.json({ blocked: false, isGlobal: false, isShopBlocked: false });
  }

  const [globalBlock, shopBlock] = await Promise.all([
    prisma.globalBlockedPhone.findUnique({
      where: { phone },
    }),
    shopId
      ? prisma.shopBlockedPhone.findUnique({
          where: { shopId_phone: { shopId, phone } },
        })
      : null,
  ]);

  const isGlobal = !!globalBlock;
  const isShopBlocked = !!shopBlock;
  const blocked = isGlobal || isShopBlocked;

  let message = "";
  if (isGlobal) {
    message = "عذراً، هذا الرقم محظور عاماً من التوصيل في كافة المحلات.";
  } else if (isShopBlocked) {
    message = "عذراً، هذا الرقم محظور من رفع الطلبات عبر هذا المحل.";
  }

  return NextResponse.json({
    blocked,
    isGlobal,
    isShopBlocked,
    message,
    phone,
  });
}

