import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminSession } from "@/lib/admin-session";
import { saveStoreCategoryImageUploaded, MAX_ORDER_IMAGE_BYTES } from "@/lib/order-image";

export async function GET() {
  const setting = await prisma.uISystemSetting.findUnique({
    where: {
      target_section: { target: "customer", section: "store_general" }
    }
  });
  return NextResponse.json(setting?.config || {});
}

export async function POST(req: Request) {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const how_to_shop_url = formData.get("how_to_shop_url") as string;
  const product_card_bg_file = formData.get("product_card_bg_file") as File;
  let product_card_bg_url = formData.get("product_card_bg_url") as string;
  const rawOpacity = Number(formData.get("product_card_bg_opacity"));
  const product_card_bg_opacity = Number.isFinite(rawOpacity)
    ? Math.min(100, Math.max(0, Math.round(rawOpacity)))
    : 40;
  const export_store_orders_excel_enabled = formData.get("export_store_orders_excel_enabled") === "on";

  // إذا تم رفع ملف جديد، نقوم بمعالجته وحفظه
  if (product_card_bg_file && product_card_bg_file.size > 0) {
    try {
      product_card_bg_url = await saveStoreCategoryImageUploaded(product_card_bg_file, MAX_ORDER_IMAGE_BYTES);
    } catch (e) {
      console.error("Failed to upload setting image", e);
    }
  }

  const current = await prisma.uISystemSetting.findUnique({
    where: {
      target_section: { target: "customer", section: "store_general" }
    }
  });

  const config = {
    ...(current?.config as any || {}),
    how_to_shop_url,
    product_card_bg_url,
    product_card_bg_opacity,
    export_store_orders_excel_enabled,
  };

  await prisma.uISystemSetting.upsert({
    where: {
      target_section: { target: "customer", section: "store_general" }
    },
    update: { config },
    create: { target: "customer", section: "store_general", config }
  });

  return NextResponse.json({
    ok: true,
    product_card_bg_url,
    product_card_bg_opacity,
    export_store_orders_excel_enabled,
  });
}
