"use server";

import { parseAlfInputToDinarNumber } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type RegionFormState = {
  error?: string;
  ok?: boolean;
};

// الدالة المستخدمة في إضافة منطقة جديدة
export async function createRegion(prevState: any, formData: FormData) {
  const name = formData.get("name") as string;
  const deliveryPriceStr = formData.get("deliveryPrice") as string;
  const deliveryPrice = parseAlfInputToDinarNumber(deliveryPriceStr);

  if (!name || deliveryPrice === null) {
    return { error: "يرجى ملء كافة الحقول بشكل صحيح" };
  // دالة لإصلاح كافة الأسعار التالفة في قاعدة البيانات
export async function fixAllDatabaseDeliveryPrices() {
  try {
    // 1. إصلاح المناطق
    const regions = await prisma.region.findMany();
    for (const r of regions) {
      const p = Number(r.deliveryPrice);
      if (p > 0 && p < 1000) {
        // إذا كان السعر 3 أو 0.003 مثلاً، نحوله إلى 3000
        const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: correctedPrice }
        });
      }
    }

    // 2. إصلاح الطلبات المعلقة التي تأثرت بالخطأ
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        deliveryPrice: { lt: 1000, gt: 0 }
      }
    });

    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
      await prisma.order.update({
        where: { id: o.id },
        data: { deliveryPrice: correctedPrice }
      });
    }

    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

  try {
    await prisma.region.create({
      data: { name, deliveryPrice // دالة لإصلاح كافة الأسعار التالفة في قاعدة البيانات
export async function fixAllDatabaseDeliveryPrices() {
  try {
    // 1. إصلاح المناطق
    const regions = await prisma.region.findMany();
    for (const r of regions) {
      const p = Number(r.deliveryPrice);
      if (p > 0 && p < 1000) {
        // إذا كان السعر 3 أو 0.003 مثلاً، نحوله إلى 3000
        const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: correctedPrice }
        });
      }
    }

    // 2. إصلاح الطلبات المعلقة التي تأثرت بالخطأ
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        deliveryPrice: { lt: 1000, gt: 0 }
      }
    });

    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
      await prisma.order.update({
        where: { id: o.id },
        data: { deliveryPrice: correctedPrice }
      });
    }

    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
    });
    revalidatePath("/admin/regions");
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  // دالة لإصلاح كافة الأسعار التالفة في قاعدة البيانات
export async function fixAllDatabaseDeliveryPrices() {
  try {
    // 1. إصلاح المناطق
    const regions = await prisma.region.findMany();
    for (const r of regions) {
      const p = Number(r.deliveryPrice);
      if (p > 0 && p < 1000) {
        // إذا كان السعر 3 أو 0.003 مثلاً، نحوله إلى 3000
        const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: correctedPrice }
        });
      }
    }

    // 2. إصلاح الطلبات المعلقة التي تأثرت بالخطأ
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        deliveryPrice: { lt: 1000, gt: 0 }
      }
    });

    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
      await prisma.order.update({
        where: { id: o.id },
        data: { deliveryPrice: correctedPrice }
      });
    }

    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
// دالة لإصلاح كافة الأسعار التالفة في قاعدة البيانات
export async function fixAllDatabaseDeliveryPrices() {
  try {
    // 1. إصلاح المناطق
    const regions = await prisma.region.findMany();
    for (const r of regions) {
      const p = Number(r.deliveryPrice);
      if (p > 0 && p < 1000) {
        // إذا كان السعر 3 أو 0.003 مثلاً، نحوله إلى 3000
        const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: correctedPrice }
        });
      }
    }

    // 2. إصلاح الطلبات المعلقة التي تأثرت بالخطأ
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        deliveryPrice: { lt: 1000, gt: 0 }
      }
    });

    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
      await prisma.order.update({
        where: { id: o.id },
        data: { deliveryPrice: correctedPrice }
      });
    }

    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// الدالة المستخدمة في التعديل
export async function updateRegion(prevState: any, formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const deliveryPriceStr = formData.get("deliveryPrice") as string;
  const deliveryPrice = parseAlfInputToDinarNumber(deliveryPriceStr);

  if (!id || !name || deliveryPrice === null) {
    return { error: "يرجى ملء كافة الحقول بشكل صحيح" };
  // دالة لإصلاح كافة الأسعار التالفة في قاعدة البيانات
export async function fixAllDatabaseDeliveryPrices() {
  try {
    // 1. إصلاح المناطق
    const regions = await prisma.region.findMany();
    for (const r of regions) {
      const p = Number(r.deliveryPrice);
      if (p > 0 && p < 1000) {
        // إذا كان السعر 3 أو 0.003 مثلاً، نحوله إلى 3000
        const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: correctedPrice }
        });
      }
    }

    // 2. إصلاح الطلبات المعلقة التي تأثرت بالخطأ
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        deliveryPrice: { lt: 1000, gt: 0 }
      }
    });

    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
      await prisma.order.update({
        where: { id: o.id },
        data: { deliveryPrice: correctedPrice }
      });
    }

    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

  try {
    await prisma.region.update({
      where: { id },
      data: { name, deliveryPrice // دالة لإصلاح كافة الأسعار التالفة في قاعدة البيانات
export async function fixAllDatabaseDeliveryPrices() {
  try {
    // 1. إصلاح المناطق
    const regions = await prisma.region.findMany();
    for (const r of regions) {
      const p = Number(r.deliveryPrice);
      if (p > 0 && p < 1000) {
        // إذا كان السعر 3 أو 0.003 مثلاً، نحوله إلى 3000
        const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: correctedPrice }
        });
      }
    }

    // 2. إصلاح الطلبات المعلقة التي تأثرت بالخطأ
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        deliveryPrice: { lt: 1000, gt: 0 }
      }
    });

    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
      await prisma.order.update({
        where: { id: o.id },
        data: { deliveryPrice: correctedPrice }
      });
    }

    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
    });
    revalidatePath("/admin/regions");
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  // دالة لإصلاح كافة الأسعار التالفة في قاعدة البيانات
export async function fixAllDatabaseDeliveryPrices() {
  try {
    // 1. إصلاح المناطق
    const regions = await prisma.region.findMany();
    for (const r of regions) {
      const p = Number(r.deliveryPrice);
      if (p > 0 && p < 1000) {
        // إذا كان السعر 3 أو 0.003 مثلاً، نحوله إلى 3000
        const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: correctedPrice }
        });
      }
    }

    // 2. إصلاح الطلبات المعلقة التي تأثرت بالخطأ
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        deliveryPrice: { lt: 1000, gt: 0 }
      }
    });

    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
      await prisma.order.update({
        where: { id: o.id },
        data: { deliveryPrice: correctedPrice }
      });
    }

    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
// دالة لإصلاح كافة الأسعار التالفة في قاعدة البيانات
export async function fixAllDatabaseDeliveryPrices() {
  try {
    // 1. إصلاح المناطق
    const regions = await prisma.region.findMany();
    for (const r of regions) {
      const p = Number(r.deliveryPrice);
      if (p > 0 && p < 1000) {
        // إذا كان السعر 3 أو 0.003 مثلاً، نحوله إلى 3000
        const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: correctedPrice }
        });
      }
    }

    // 2. إصلاح الطلبات المعلقة التي تأثرت بالخطأ
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        deliveryPrice: { lt: 1000, gt: 0 }
      }
    });

    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
      await prisma.order.update({
        where: { id: o.id },
        data: { deliveryPrice: correctedPrice }
      });
    }

    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// الدالة المستخدمة في القائمة السريعة
export async function updateRegionAction(id: string, name: string, price: number) {
  try {
    // نعتبر السعر القادم من الواجهة دائماً بـ "الألف" ونحوله للدينار
    const dinarPrice = price * 1000;

    await prisma.region.update({
      where: { id },
      data: {
        name,
        deliveryPrice: dinarPrice
      // دالة لإصلاح كافة الأسعار التالفة في قاعدة البيانات
export async function fixAllDatabaseDeliveryPrices() {
  try {
    // 1. إصلاح المناطق
    const regions = await prisma.region.findMany();
    for (const r of regions) {
      const p = Number(r.deliveryPrice);
      if (p > 0 && p < 1000) {
        // إذا كان السعر 3 أو 0.003 مثلاً، نحوله إلى 3000
        const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: correctedPrice }
        });
      }
    }

    // 2. إصلاح الطلبات المعلقة التي تأثرت بالخطأ
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        deliveryPrice: { lt: 1000, gt: 0 }
      }
    });

    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
      await prisma.order.update({
        where: { id: o.id },
        data: { deliveryPrice: correctedPrice }
      });
    }

    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
    });
    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  // دالة لإصلاح كافة الأسعار التالفة في قاعدة البيانات
export async function fixAllDatabaseDeliveryPrices() {
  try {
    // 1. إصلاح المناطق
    const regions = await prisma.region.findMany();
    for (const r of regions) {
      const p = Number(r.deliveryPrice);
      if (p > 0 && p < 1000) {
        // إذا كان السعر 3 أو 0.003 مثلاً، نحوله إلى 3000
        const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: correctedPrice }
        });
      }
    }

    // 2. إصلاح الطلبات المعلقة التي تأثرت بالخطأ
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        deliveryPrice: { lt: 1000, gt: 0 }
      }
    });

    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
      await prisma.order.update({
        where: { id: o.id },
        data: { deliveryPrice: correctedPrice }
      });
    }

    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
// دالة لإصلاح كافة الأسعار التالفة في قاعدة البيانات
export async function fixAllDatabaseDeliveryPrices() {
  try {
    // 1. إصلاح المناطق
    const regions = await prisma.region.findMany();
    for (const r of regions) {
      const p = Number(r.deliveryPrice);
      if (p > 0 && p < 1000) {
        // إذا كان السعر 3 أو 0.003 مثلاً، نحوله إلى 3000
        const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
        await prisma.region.update({
          where: { id: r.id },
          data: { deliveryPrice: correctedPrice }
        });
      }
    }

    // 2. إصلاح الطلبات المعلقة التي تأثرت بالخطأ
    const orders = await prisma.order.findMany({
      where: {
        status: "pending",
        deliveryPrice: { lt: 1000, gt: 0 }
      }
    });

    for (const o of orders) {
      const p = Number(o.deliveryPrice);
      const correctedPrice = p < 1 ? p * 1000000 : p * 1000;
      await prisma.order.update({
        where: { id: o.id },
        data: { deliveryPrice: correctedPrice }
      });
    }

    revalidatePath("/admin/regions");
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
