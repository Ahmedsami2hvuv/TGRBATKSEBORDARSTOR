"use server";

import { prisma } from "@/lib/prisma";

export async function createSharedCart(ownerName: string, initialItemsJson: string) {
  try {
    if (!ownerName.trim()) {
      return { error: "يرجى إدخال اسم المالك" };
    }

    let items: any[] = [];
    try {
      items = JSON.parse(initialItemsJson || "[]");
    } catch (e) {
      items = [];
    }

    // نضمن أن جميع العناصر المبدئية معلمة بأنها مضافة بواسطة مالك السلة
    const itemsWithOwner = items.map((item: any) => ({
      ...item,
      addedBy: ownerName,
    }));

    const sharedCart = await prisma.sharedCart.create({
      data: {
        ownerName,
        items: itemsWithOwner,
        status: "active",
      },
    });

    return { ok: true, cartId: sharedCart.id };
  } catch (err: any) {
    console.error("فشل إنشاء السلة المشتركة:", err);
    return { error: "فشل في إنشاء السلة المشتركة، يرجى المحاولة لاحقاً" };
  }
}

export async function getSharedCart(id: string) {
  try {
    const cart = await prisma.sharedCart.findUnique({
      where: { id },
    });
    if (!cart) {
      return { error: "السلة المشتركة غير موجودة" };
    }
    return { ok: true, cart };
  } catch (err: any) {
    console.error("فشل جلب السلة المشتركة:", err);
    return { error: "فشل في جلب بيانات السلة" };
  }
}

export async function addToSharedCart(cartId: string, product: any, addedBy: string) {
  try {
    const cartRecord = await prisma.sharedCart.findUnique({
      where: { id: cartId },
    });

    if (!cartRecord) {
      return { error: "السلة المشتركة غير موجودة" };
    }

    if (cartRecord.status !== "active") {
      return { error: "هذه السلة مكتملة بالفعل ولا يمكن التعديل عليها" };
    }

    let items = Array.isArray(cartRecord.items) ? (cartRecord.items as any[]) : [];

    const existingIndex = items.findIndex((item: any) => item.id === product.id);

    if (existingIndex > -1) {
      items[existingIndex].quantity = (items[existingIndex].quantity || 1) + 1;
      // نحدث اسم الشخص الذي أضافه مؤخراً إذا رغبنا، أو نحافظ على المضيف الأول.
      // من الأفضل أن نضيف اسم الشخص المضيف للمنتج
    } else {
      items.push({
        id: product.id,
        name: product.name,
        price: Number(product.salePrice || product.price || 0),
        photo: Array.isArray(product.photoUrls) ? product.photoUrls[0] : (product.photoUrls || product.photo || ""),
        quantity: 1,
        addedBy: addedBy || "عضو العائلة",
        supplierId: product.supplierId || null,
        productId: product.id,
      });
    }

    await prisma.sharedCart.update({
      where: { id: cartId },
      data: { items },
    });

    return { ok: true };
  } catch (err: any) {
    console.error("فشل إضافة المنتج للسلة المشتركة:", err);
    return { error: "فشل في إضافة المنتج للسلة المشتركة" };
  }
}

export async function updateSharedCartQty(cartId: string, productId: string, delta: number) {
  try {
    const cartRecord = await prisma.sharedCart.findUnique({
      where: { id: cartId },
    });

    if (!cartRecord) {
      return { error: "السلة غير موجودة" };
    }

    if (cartRecord.status !== "active") {
      return { error: "هذه السلة مكتملة بالفعل" };
    }

    let items = Array.isArray(cartRecord.items) ? (cartRecord.items as any[]) : [];
    items = items.map((item: any) => {
      if (item.id === productId) {
        return { ...item, quantity: Math.max(1, (item.quantity || 1) + delta) };
      }
      return item;
    });

    await prisma.sharedCart.update({
      where: { id: cartId },
      data: { items },
    });

    return { ok: true };
  } catch (err: any) {
    console.error("فشل تحديث الكمية في السلة المشتركة:", err);
    return { error: "فشل في تحديث الكمية" };
  }
}

export async function removeFromSharedCart(cartId: string, productId: string) {
  try {
    const cartRecord = await prisma.sharedCart.findUnique({
      where: { id: cartId },
    });

    if (!cartRecord) {
      return { error: "السلة غير موجودة" };
    }

    if (cartRecord.status !== "active") {
      return { error: "هذه السلة مكتملة بالفعل" };
    }

    let items = Array.isArray(cartRecord.items) ? (cartRecord.items as any[]) : [];
    items = items.filter((item: any) => item.id !== productId);

    await prisma.sharedCart.update({
      where: { id: cartId },
      data: { items },
    });

    return { ok: true };
  } catch (err: any) {
    console.error("فشل حذف المنتج من السلة المشتركة:", err);
    return { error: "فشل في حذف المنتج" };
  }
}
